import React from 'react';
import MoneyBook from '../components/MoneyBook.jsx';

export default function Bank() {
  return <MoneyBook title="Bankové výpisy" accColl="bankaccounts" docColl="bankmoves" accKey="accountId" accLabel="Bankový účet" hasIban />;
}
