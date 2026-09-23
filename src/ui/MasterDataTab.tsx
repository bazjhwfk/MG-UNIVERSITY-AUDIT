import { useState } from 'react';
import { newId } from '../domain/bill';
import { CONTRACTOR_TYPES } from '../domain/types';
import { useData } from '../state/data';
import { errorMessage, type Session } from '../state/session';
import { Field, NumberInput, Select, TextInput } from './fields';

export function MasterDataTab({ session }: { session: Session }) {
  const data = useData();
  const [c, setC] = useState({ name: '', address: '', gstNo: '', panNo: '', phone: '', entityType: 'Person' });
  const [b, setB] = useState({ code: '', headOfAccount: '', allocation: 0 });

  const addContractor = async () => {
    try {
      await data.saveContractor({ id: newId(), ...c, email: '', isActive: true, updatedAt: '' });
      setC((prev) => ({ ...prev, name: '' }));
      session.show('Contractor added locally.');
    } catch (error) {
      session.show('Contractor failed: ' + errorMessage(error));
    }
  };

  const addBudget = async () => {
    try {
      await data.saveBudget({ id: newId(), ...b, balance: b.allocation, fiscalYear: '', isActive: true, updatedAt: '' });
      setB({ code: '', headOfAccount: '', allocation: 0 });
      session.show('Budget added locally.');
    } catch (error) {
      session.show('Budget failed: ' + errorMessage(error));
    }
  };

  return (
    <div className="master-tab">
      <section>
        <h2 className="form-heading">Contractors</h2>
        <Field label="Name"><TextInput value={c.name} onChange={(name) => setC({ ...c, name })} /></Field>
        <Field label="Contractor address"><TextInput value={c.address} onChange={(address) => setC({ ...c, address })} /></Field>
        <Field label="GST no"><TextInput value={c.gstNo} onChange={(gstNo) => setC({ ...c, gstNo })} /></Field>
        <Field label="PAN no"><TextInput value={c.panNo} onChange={(panNo) => setC({ ...c, panNo })} /></Field>
        <Field label="Phone no"><TextInput value={c.phone} onChange={(phone) => setC({ ...c, phone })} /></Field>
        <Field label="Type"><Select value={c.entityType} onChange={(entityType) => setC({ ...c, entityType })} options={CONTRACTOR_TYPES} /></Field>
        <div className="button-row"><button className="btn btn-dark" onClick={() => void addContractor()}>Add contractor</button></div>
        <div className="grid-wrap">
          <table className="grid">
            <thead><tr><th>Sl No</th><th>Contractors name</th><th>Contractors address</th><th>GST no</th><th>PAN no</th><th>Ph no</th></tr></thead>
            <tbody>
              {data.contractors.map((x, i) => (
                <tr key={x.id}><td>{i + 1}</td><td>{x.name}</td><td>{x.address}</td><td>{x.gstNo}</td><td>{x.panNo}</td><td>{x.phone}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="form-heading">Budgets</h2>
        <Field label="Code"><TextInput value={b.code} onChange={(code) => setB({ ...b, code })} /></Field>
        <Field label="Head of Account"><TextInput value={b.headOfAccount} onChange={(headOfAccount) => setB({ ...b, headOfAccount })} /></Field>
        <Field label="Allocation"><NumberInput value={b.allocation} onChange={(allocation) => setB({ ...b, allocation })} /></Field>
        <div className="button-row"><button className="btn btn-dark" onClick={() => void addBudget()}>Add budget</button></div>
        <div className="grid-wrap">
          <table className="grid">
            <thead><tr><th>Code</th><th className="wide">Head</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {data.budgets.map((x) => (
                <tr key={x.id}><td>{x.code}</td><td className="wide">{x.headOfAccount}</td><td className="num">{x.balance}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
