import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';

export default function LecturerContracts(){
  return (
    <div className='p-4 space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>My Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-gray-600'>No contracts data yet. This is a placeholder.</p>
        </CardContent>
      </Card>
    </div>
  );
}
