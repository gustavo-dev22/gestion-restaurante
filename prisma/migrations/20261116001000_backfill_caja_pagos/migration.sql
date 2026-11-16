BEGIN TRY

BEGIN TRAN;

-- Pedidos ya pagados: fecha de pago y pago histórico sin turno.
UPDATE [dbo].[Pedidos]
SET [pagadoEn] = COALESCE([pagadoEn], [fecha_creacion])
WHERE [estado] = 'Pagado' AND [pagadoEn] IS NULL;

INSERT INTO [dbo].[Pagos]
    ([pedidoId], [turnoId], [cajeroId], [cajeroNombre], [metodo], [monto],
     [propina], [descuento], [referencia], [estado], [origen], [createdAt])
SELECT
    p.[id],
    NULL,
    p.[usuarioId],
    p.[nombreMesero],
    CASE
        WHEN p.[metodoPago] IN ('Efectivo', 'Tarjeta', 'Yape/Plin') THEN p.[metodoPago]
        ELSE 'Otro'
    END,
    p.[total],
    0,
    0,
    NULL,
    'Conciliado',
    'Legacy',
    COALESCE(p.[fecha_creacion], GETDATE())
FROM [dbo].[Pedidos] p
WHERE p.[estado] = 'Pagado'
  AND COALESCE(p.[total], 0) > 0
  AND NOT EXISTS (
      SELECT 1 FROM [dbo].[Pagos] pg WHERE pg.[pedidoId] = p.[id]
  );

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
