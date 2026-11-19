import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileChartColumn } from 'lucide-react';
import { api } from '../../services/api';
import type { Dashboard } from '../../types';
import { number, safeCsvCell } from '../../lib/format';
import { Button, Empty, ErrorState, PageTitle, Panel, SearchableSelect, Skeleton } from '../../components/ui';
import { RowItem, RowStagger } from '../../components/motion';
const periods = [{ value: '7', label: 'Últimos 7 días' }, { value: '30', label: 'Últimos 30 días' }, { value: '90', label: 'Últimos 90 días' }];
export function ReportsPage() {
  const [days, setDays] = useState('30');
  const query = useQuery({ queryKey: ['reports', days], queryFn: async () => (await api.get<Dashboard>('/dashboard', { params: { days } })).data });
  const rows = query.data?.ordersByDay ?? [];
  const download = () => { const content = ['Fecha,Órdenes,Valor', ...rows.map(r => [safeCsvCell(r.date), r.count, r.total].join(','))].join('\r\n'); const url = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `ordenes-${days}-dias.csv`; a.click(); URL.revokeObjectURL(url); };
  return <>
    <PageTitle title="Reportes" description="Agregaciones calculadas en el backend para analizar el comportamiento de la operación.">
      <SearchableSelect ariaLabel="Período del reporte" className="select-compact" value={days} onChange={setDays} options={periods} />
      <Button onClick={download} disabled={!rows.length}><Download size={15} />Exportar reporte</Button>
    </PageTitle>
    <Panel title="Órdenes por día" description="Conteos y valor agregado del período seleccionado" action={<FileChartColumn size={20} />}>
      {query.isPending ? <Skeleton rows={6} /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : rows.length ? <div className="table-scroll"><table><thead><tr><th scope="col">Fecha</th><th scope="col">Órdenes</th><th scope="col">Valor acumulado (COP)</th></tr></thead><RowStagger>{rows.map(r => <RowItem key={r.date}><td>{r.date.slice(0, 10)}</td><td>{number(r.count)}</td><td>{number(r.total)}</td></RowItem>)}</RowStagger></table></div> : <Empty title="No hay actividad en este período" />}
    </Panel>
  </>;
}
