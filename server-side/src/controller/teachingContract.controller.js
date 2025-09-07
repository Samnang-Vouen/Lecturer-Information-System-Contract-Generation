import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { TeachingContract, TeachingContractCourse, User } from '../model/index.js';
import Candidate from '../model/candidate.model.js';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toKhmerDigits(str) {
  const map = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
  return String(str).replace(/[0-9]/g, d => map[d]);
}

function loadTemplate(name) {
  const filePath = path.join(process.cwd(), 'src', 'utils', name);
  return fs.readFileSync(filePath, 'utf8');
}

function embedLogo(html) {
  const logoPath = path.join(process.cwd(), 'src', 'utils', 'cadt_logo.png');
  let base64 = '';
  try { base64 = fs.readFileSync(logoPath, 'base64'); } catch { base64 = ''; }
  return html.replace('src="cadt_logo.png"', `src="data:image/png;base64,${base64}"`);
}

export async function createDraftContract(req, res) {
  try {
    const { lecturer_user_id, academic_year, term, year_level, start_date, end_date, courses } = req.body;
    if (!lecturer_user_id || !academic_year || !term || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({ message: 'lecturer_user_id, academic_year, term and at least one course required' });
    }

    const contract = await TeachingContract.create({
      lecturer_user_id,
      academic_year,
      term,
      year_level: year_level || null,
      start_date: start_date || null,
      end_date: end_date || null,
      status: 'DRAFT',
      created_by: req.user.id
    });

    for (const c of courses) {
      await TeachingContractCourse.create({
        contract_id: contract.id,
        course_id: c.course_id,
        class_id: c.class_id || null,
        course_name: c.course_name,
        year_level: c.year_level || null,
        term: c.term || term,
        academic_year: c.academic_year || academic_year,
        hours: c.hours || null
      });
    }

    return res.status(201).json({ id: contract.id });
  } catch (e) {
    console.error('[createDraftContract]', e);
    return res.status(500).json({ message: 'Failed to create draft', error: e.message });
  }
}

export async function getContract(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const contract = await TeachingContract.findByPk(id, {
      include: [
        { model: TeachingContractCourse, as: 'courses' },
        { model: User, as: 'lecturer', attributes: ['id','email','display_name','department_name'] }
      ]
    });
    if (!contract) return res.status(404).json({ message: 'Not found' });
    return res.json(contract);
  } catch (e) {
    console.error('[getContract]', e);
    return res.status(500).json({ message: 'Failed to get contract', error: e.message });
  }
}

// List contracts with filters and pagination
export async function listContracts(req, res) {
  try {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  // Default to 10 per page; allow override up to 100
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const offset = (page - 1) * limit;
    const { academic_year, term, status, q } = req.query;

    const where = {};
    if (academic_year) where.academic_year = academic_year;
    if (term) where.term = term;
    if (status) where.status = status;

    // Role-based scoping: lecturers only see their own contracts
    const role = req.user?.role;
    if (role === 'lecturer') {
      where.lecturer_user_id = req.user.id;
    }

    const include = [
      { model: TeachingContractCourse, as: 'courses' },
      { model: User, as: 'lecturer', attributes: ['id','email','display_name','department_name'] }
    ];

    // Basic text search on lecturer fields
    const Sequelize = (await import('sequelize')).default;
    if (q) {
      include[1].where = {
        [Sequelize.Op.or]: [
          { display_name: { [Sequelize.Op.like]: `%${q}%` } },
          { email: { [Sequelize.Op.like]: `%${q}%` } }
        ]
      };
      include[1].required = false;
    }

    const { rows, count } = await TeachingContract.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [['created_at','DESC']]
    });

    // For management/admin, attach hourlyRateThisYear (USD) from Candidate profile for each lecturer
    let data = rows;
    try {
      const role = req.user?.role;
      if (['admin','management','superadmin'].includes(role)) {
        const enriched = [];
        for (const row of rows) {
          const plain = row.toJSON();
          let hourlyRateUsd = null;
          try {
            // Normalize lecturer name similar to generatePdf
            const titleRegex = /^(mr\.?|ms\.?|mrs\.?|dr\.?|prof\.?|professor|miss)\s+/i;
            const normalizeName = (s='') => String(s).trim().replace(titleRegex,'').replace(/\s+/g,' ').trim();
            const displayName = plain?.lecturer?.display_name || '';
            const cleanedName = normalizeName(displayName);
            let cand = null;
            if (cleanedName) {
              const Sequelize = (await import('sequelize')).default;
              cand = await Candidate.findOne({
                where: Sequelize.where(Sequelize.fn('LOWER', Sequelize.fn('TRIM', Sequelize.col('fullName'))), cleanedName.toLowerCase())
              });
            }
            if (!cand && plain?.lecturer?.email) {
              cand = await Candidate.findOne({ where: { email: plain.lecturer.email } });
            }
            if (cand && cand.hourlyRate != null) {
              const parsed = parseFloat(String(cand.hourlyRate).replace(/[^0-9.]/g, ''));
              hourlyRateUsd = Number.isFinite(parsed) ? parsed : null;
            }
          } catch (rateErr) {
            // Non-fatal; leave as null
          }
          plain.hourlyRateThisYear = hourlyRateUsd;
          enriched.push(plain);
        }
        data = enriched;
      }
    } catch (enrichErr) {
      // If enrichment fails, fall back to raw rows
      data = rows;
    }

    return res.json({ data, page, limit, total: count });
  } catch (e) {
    console.error('[listContracts]', e);
    return res.status(500).json({ message: 'Failed to list contracts', error: e.message });
  }
}

export async function generatePdf(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const contract = await TeachingContract.findByPk(id, {
      include: [
        { model: TeachingContractCourse, as: 'courses' },
        { model: User, as: 'lecturer', attributes: ['id','email','display_name','department_name'] }
      ]
    });
    if (!contract) return res.status(404).json({ message: 'Not found' });

    let htmlEn = loadTemplate('lecturer_contract.html');
    let htmlKh = loadTemplate('khmer_contract.html');
    const lecturerName = contract.lecturer?.display_name || contract.lecturer?.email || 'Lecturer';
    const startDate = (contract.start_date ? new Date(contract.start_date) : new Date()).toISOString().slice(0,10);
    const subject = contract.courses[0]?.course_name || 'Course';
    const hours = (contract.courses.reduce((a,c)=>a+(c.hours||0),0)) || 0;

    // Lookup hourly rate (USD) from Candidate profile by name or email
    let hourlyRateUsd = 0;
    try {
      const titleRegex = /^(mr\.?|ms\.?|mrs\.?|dr\.?|prof\.?|professor|miss)\s+/i;
      const normalizeName = (s = '') => String(s).trim().replace(titleRegex, '').replace(/\s+/g, ' ').trim();
      const rawName = contract.lecturer?.display_name || '';
      const cleanedName = normalizeName(rawName);
      let cand = null;
      if (cleanedName) {
        const Sequelize = (await import('sequelize')).default;
        cand = await Candidate.findOne({ where: Sequelize.where(Sequelize.fn('LOWER', Sequelize.fn('TRIM', Sequelize.col('fullName'))), cleanedName.toLowerCase()) });
      }
      if (!cand && contract.lecturer?.email) {
        cand = await Candidate.findOne({ where: { email: contract.lecturer.email } });
      }
      if (cand && cand.hourlyRate != null) {
        const parsed = parseFloat(String(cand.hourlyRate).replace(/[^0-9.]/g, ''));
        hourlyRateUsd = Number.isFinite(parsed) ? parsed : 0;
      }
    } catch (rateErr) {
      console.warn('[generatePdf] hourly rate lookup failed:', rateErr.message);
    }

    const totalUsd = (hours || 0) * (hourlyRateUsd || 0);
    const usdToKhr = parseFloat(process.env.USD_TO_KHR || process.env.EXCHANGE_RATE_KHR || '4100');
    const totalKhr = Math.round((Number.isFinite(totalUsd) ? totalUsd : 0) * (Number.isFinite(usdToKhr) ? usdToKhr : 4100));

    htmlEn = embedLogo(htmlEn)
      .replaceAll('{lecturer_name}', lecturerName)
      .replaceAll('{start_date}', startDate)
      .replaceAll('{salary}', String(hours))
      .replaceAll('{subject}', subject)
      .replaceAll('{term}', contract.term)
      .replaceAll('{gen}', contract.year_level || '')
      .replaceAll('{group}', '')
      .replaceAll('{dept_name}', '')
      .replaceAll('{course_name}', subject)
      .replaceAll('{description}', '')
      // English template label shows KHR; provide KHR amount computed from USD hourly rate
      .replaceAll('{total_salary}', totalKhr.toLocaleString('en-US'))
      .replaceAll('{sign_date}', startDate);

    htmlKh = embedLogo(htmlKh)
      .replaceAll('{lecturer_name}', lecturerName)
      .replaceAll('{start_date}', startDate)
      .replaceAll('{salary}', toKhmerDigits(hours))
      .replaceAll('{subject}', subject)
      .replaceAll('{term}', toKhmerDigits(contract.term))
      .replaceAll('{gen}', toKhmerDigits(contract.year_level || ''))
      .replaceAll('{group}', '')
      .replaceAll('{dept_name}', '')
      .replaceAll('{course_name}', subject)
      .replaceAll('{description}', '')
      // Khmer version requires total salary in KHR based on current exchange rate
      .replaceAll('{total_salary}', toKhmerDigits(totalKhr))
      .replaceAll('{date}', toKhmerDigits(new Date().getDate()))
      .replaceAll('{month}', toKhmerDigits(new Date().getMonth()+1))
      .replaceAll('{year}', toKhmerDigits(new Date().getFullYear()));

    const combined = `
      <html>
        <head><style>.page-break{page-break-before:always;}</style></head>
        <body>
          <div>${htmlEn}</div>
          <div class="page-break"></div>
          <div>${htmlKh}</div>
        </body>
      </html>`;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(combined, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    const outDir = path.join(process.cwd(), 'uploads', 'contracts');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, `contract_${contract.id}.pdf`);
    fs.writeFileSync(filePath, pdfBuffer);
    await contract.update({ pdf_path: filePath });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contract_${contract.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (e) {
    console.error('[generatePdf]', e);
    return res.status(500).json({ message: 'Failed to generate PDF', error: e.message });
  }
}

export async function updateStatus(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    const allowed = ['DRAFT','LECTURER_SIGNED','MANAGEMENT_SIGNED','COMPLETED'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const contract = await TeachingContract.findByPk(id);
    if (!contract) return res.status(404).json({ message: 'Not found' });
    await contract.update({ status });
    return res.json({ message: 'Updated' });
  } catch (e) {
    console.error('[updateStatus]', e);
    return res.status(500).json({ message: 'Failed to update status', error: e.message });
  }
}

// Delete a contract (admin/superadmin). Only allowed for DRAFT status.
export async function deleteContract(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const contract = await TeachingContract.findByPk(id);
    if (!contract) return res.status(404).json({ message: 'Not found' });
    if (contract.status !== 'DRAFT') {
      return res.status(400).json({ message: 'Only DRAFT contracts can be deleted' });
    }

    // Clean up files if any
    const files = [contract.pdf_path, contract.lecturer_signature_path, contract.management_signature_path].filter(Boolean);
    for (const f of files) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }

    // Remove related courses explicitly for safety
    await TeachingContractCourse.destroy({ where: { contract_id: id } });
    await TeachingContract.destroy({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('[deleteContract]', e);
    return res.status(500).json({ message: 'Failed to delete contract', error: e.message });
  }
}

// Signature upload (base64 or multipart). Here we handle multipart via multer.
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const outDir = path.join(process.cwd(), 'uploads', 'signatures');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    cb(null, outDir);
  },
  filename: function (req, file, cb) {
    const id = parseInt(req.params.id, 10);
    const who = (req.body.who || 'lecturer').toLowerCase();
    cb(null, `contract_${id}_${who}_${Date.now()}.png`);
  }
});
export const upload = multer({ storage });

export async function uploadSignature(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const who = (req.body.who || 'lecturer').toLowerCase();
    const contract = await TeachingContract.findByPk(id);
    if (!contract) return res.status(404).json({ message: 'Not found' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const filePath = req.file.path;
    const now = new Date();
    if (who === 'lecturer') {
      await contract.update({ lecturer_signature_path: filePath, lecturer_signed_at: now, status: 'LECTURER_SIGNED' });
    } else {
      await contract.update({ management_signature_path: filePath, management_signed_at: now, status: contract.status === 'LECTURER_SIGNED' ? 'COMPLETED' : 'MANAGEMENT_SIGNED' });
    }
    return res.json({ message: 'Signature uploaded', path: filePath, status: contract.status });
  } catch (e) {
    console.error('[uploadSignature]', e);
    return res.status(500).json({ message: 'Failed to upload signature', error: e.message });
  }
}
