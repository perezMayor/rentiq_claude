export type TemplateFunctionName =
  | ''
  | 'CONFIRMACION_RESERVA'
  | 'PRESUPUESTO'
  | 'FACTURA'
  | 'CONTRATO'
  | 'CANCELACION_RESERVA'
  | 'MODIFICACION_RESERVA'
  | 'PAGO_ONLINE_LINK'
  | 'SOLICITUD_FIRMA_CONTRATO';

export type TemplateFunctionOption = {
  value: TemplateFunctionName;
  label: string;
};

export const TEMPLATE_FUNCTION_OPTIONS: TemplateFunctionOption[] = [
  { value: '', label: '— Sin función asignada —' },
  { value: 'CONFIRMACION_RESERVA', label: 'Confirmación de reserva' },
  { value: 'PRESUPUESTO', label: 'Presupuesto' },
  { value: 'FACTURA', label: 'Factura' },
  { value: 'CONTRATO', label: 'Contrato' },
  { value: 'CANCELACION_RESERVA', label: 'Cancelación de reserva' },
  { value: 'MODIFICACION_RESERVA', label: 'Modificación de reserva' },
  { value: 'PAGO_ONLINE_LINK', label: 'Enlace de pago online' },
  { value: 'SOLICITUD_FIRMA_CONTRATO', label: 'Solicitud de firma de contrato' },
];
