import React from 'react';
import MoneyBook from '../components/MoneyBook.jsx';

export default function CashBook() {
  return <MoneyBook title="Pokladničná kniha" accColl="cashboxes" docColl="cashdocs" accKey="cashboxId" accLabel="Pokladňa" />;
}
