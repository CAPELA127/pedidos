import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

export async function GET() {
  // En un entorno real, aquí se consultaría la base de datos Supabase
  // const { data: orders } = await supabase.from('Orders').select('...');

  // Mock data para demostración
  const data = [
    { 'Pedido ID': 'ORD-1002', 'Cliente': 'Juan Pérez', 'Teléfono': '300xxxx', 'REF': '25872-2', 'Producto': 'Cinta Capitán', 'Cantidad': 24, 'Estado': 'Pendiente', 'Fecha': '22-05-2026' },
    { 'Pedido ID': 'ORD-1003', 'Cliente': 'María López', 'Teléfono': '310xxxx', 'REF': '11221-4', 'Producto': 'Balón F5', 'Cantidad': 12, 'Estado': 'Empacado', 'Fecha': '21-05-2026' },
  ];

  // Crear libro de trabajo (workbook) y hoja (worksheet)
  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Pedidos');

  // Ajustar anchos de columnas
  const wscols = [
    { wch: 12 }, // Pedido ID
    { wch: 20 }, // Cliente
    { wch: 15 }, // Teléfono
    { wch: 15 }, // REF
    { wch: 30 }, // Producto
    { wch: 10 }, // Cantidad
    { wch: 15 }, // Estado
    { wch: 15 }, // Fecha
  ];
  worksheet['!cols'] = wscols;

  // Generar buffer del archivo Excel
  const buf = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Configurar headers para descarga
  const headers = new Headers();
  headers.append('Content-Disposition', 'attachment; filename="pedidos_bodega.xlsx"');
  headers.append('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  return new NextResponse(buf, { headers });
}
