export interface Proveedor {
  id: string;
  razonSocial: string;
  cuit: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  localidad: string;
  rubro: string;
  estado: "Activo" | "Inactivo" | "Suspendido" | "Pendiente";
  ultimoPedido: string;
}

export const proveedores: Proveedor[] = [
  { id: "1", razonSocial: "Distribuidora Técnica SRL", cuit: "30-71234567-9", contacto: "Carlos Méndez", email: "carlos@distribuidoratecnica.com", telefono: "343-4551234", direccion: "Av. 25 de Mayo 1230", localidad: "Paraná", rubro: "Bombas", estado: "Activo", ultimoPedido: "20/07/2026" },
  { id: "2", razonSocial: "Piletecno SA", cuit: "30-72345678-0", contacto: "Laura Giménez", email: "lgimenez@piletecno.com.ar", telefono: "341-4567890", direccion: "Calle Entre Ríos 456", localidad: "Santa Fe", rubro: "Piletas", estado: "Activo", ultimoPedido: "15/07/2026" },
  { id: "3", razonSocial: "Químicos del Litoral", cuit: "30-73456789-1", contacto: "Roberto Álvarez", email: "ralvarez@quimicoslitoral.com", telefono: "343-5678901", direccion: "Ruta 11 km 5", localidad: "Paraná", rubro: "Químicos", estado: "Activo", ultimoPedido: "10/08/2026" },
  { id: "4", razonSocial: "Accesorios Pool SA", cuit: "30-74567890-2", contacto: "María López", email: "mlopez@accesoriospool.com", telefono: "341-6789012", direccion: "San Martín 789", localidad: "Rosario", rubro: "Accesorios", estado: "Suspendido", ultimoPedido: "01/06/2026" },
  { id: "5", razonSocial: "Herramientas Maibach", cuit: "30-75678901-3", contacto: "Jorge Maibach", email: "jmaibach@herramientasmaibach.com", telefono: "343-7890123", direccion: "Belgrano 1024", localidad: "Paraná", rubro: "Herramientas", estado: "Activo", ultimoPedido: "25/07/2026" },
  { id: "6", razonSocial: "Fibras Industriales SR", cuit: "30-76789012-4", contacto: "Pedro Suárez", email: "psuarez@fibrasindustriales.com", telefono: "341-8901234", direccion: "Mitre 2048", localidad: "Santa Fe", rubro: "Piletas", estado: "Pendiente", ultimoPedido: "—" },
  { id: "7", razonSocial: "Sistemas de Filtrado SA", cuit: "30-77890123-5", contacto: "Ana Martínez", email: "amartinez@sistemasfiltrado.com", telefono: "343-9012345", direccion: "San Lorenzo 333", localidad: "Paraná", rubro: "Accesorios", estado: "Activo", ultimoPedido: "05/08/2026" },
  { id: "8", razonSocial: "Electricidad y Bombas SRL", cuit: "30-78901234-6", contacto: "Fernando Gómez", email: "fgomez@electricidadybombas.com", telefono: "341-0123456", direccion: "Corrientes 567", localidad: "Rosario", rubro: "Bombas", estado: "Inactivo", ultimoPedido: "12/04/2026" },
];
