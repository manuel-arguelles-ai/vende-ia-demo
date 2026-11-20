// app/api/catalogo/plantilla/route.ts
export const runtime = 'nodejs'

const PLANTILLAS: Record<string, string> = {
  libros: 'isbn,titulo,autor,editorial,edicion,anio,precio_soles,stock_central,stock_miraflores,stock_sanisidro,stock_total,genero,descripcion\n978-612-0000-00-0,El Proceso,Franz Kafka,Tusquets,1,1925,50.00,2,0,1,3,novela,Clásico sobre la culpa y la burocracia\n',
  generico: 'nombre,precio,stock,categoria,marca,presentacion,descripcion,sku,tags\nAceite de Coco,49.00,10,alimentación,BioSelva,500 ml,Prensado en frío,SKU-001,"orgánico,cocina"\n',
}

export async function GET(req: Request) {
  const formato = new URL(req.url).searchParams.get('formato') === 'libros' ? 'libros' : 'generico'
  return new Response(PLANTILLAS[formato], {
    status: 200,
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="plantilla-${formato}.csv"` },
  })
}
