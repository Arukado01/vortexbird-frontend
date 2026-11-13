import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination, ErrorState, Status } from './index';
import axios from 'axios';
describe('Operational UI behavior',()=>{
  it('does not request pages outside the paginated API response',()=>{const onChange=vi.fn();render(<Pagination page={{items:[],page:1,pageSize:15,totalCount:21,totalPages:2,hasPreviousPage:false,hasNextPage:true}} onChange={onChange}/>);expect((screen.getByRole('button',{name:'Página anterior'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Página siguiente'}));expect(onChange).toHaveBeenCalledWith(2);});
  it('shows access denied and preserves a correlation reference',()=>{const error=new axios.AxiosError('Forbidden');error.response={status:403,data:{detail:'Canal no permitido',correlationId:'trace-123'},statusText:'Forbidden',headers:{},config:{headers:new axios.AxiosHeaders()}};render(<ErrorState error={error}/>);expect(screen.getByRole('alert').textContent).toContain('No tienes permiso');expect(screen.getByRole('alert').textContent).toContain('trace-123');});
  it('translates DLQ status without presenting it as healthy',()=>{render(<Status value="dead_letter"/>);expect(screen.getByText('En DLQ').className).not.toContain('status-good');});
});
