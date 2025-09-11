import sequelize from '../config/db.js';
import { NewContract, ContractItem, User } from '../model/index.js';

export async function createContract(req, res) {
  const t = await sequelize.transaction();
  try {
    const { lecturerId, items, start_date, end_date, salary } = req.body || {};
    if (!lecturerId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'lecturerId and at least one item are required' });
    }

    const contract = await NewContract.create({
      lecturer_user_id: lecturerId,
      start_date: start_date || null,
      end_date: end_date || null,
      salary: salary || null,
      created_by: req.user.id
    }, { transaction: t });

    const rows = items.filter(Boolean).map(it => ({ contract_id: contract.id, item: String(it) }));
    if (rows.length) {
      await ContractItem.bulkCreate(rows, { transaction: t });
    }

    await t.commit();

    const created = await NewContract.findByPk(contract.id, { include: [{ model: ContractItem, as: 'items' }, { model: User, as: 'lecturer', attributes: ['id','display_name','email'] }] });
    return res.status(201).json(created);
  } catch (e) {
    await t.rollback();
    console.error('[createContract]', e);
    return res.status(500).json({ message: 'Failed to create contract', error: e.message });
  }
}

export async function getContractById(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const found = await NewContract.findByPk(id, { include: [{ model: ContractItem, as: 'items' }, { model: User, as: 'lecturer', attributes: ['id','display_name','email'] }] });
    if (!found) return res.status(404).json({ message: 'Not found' });
    return res.json(found);
  } catch (e) {
    console.error('[getContractById]', e);
    return res.status(500).json({ message: 'Failed to fetch contract', error: e.message });
  }
}
