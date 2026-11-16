BEGIN TRY

BEGIN TRAN;

-- Los pedidos existentes parten de un pago completo o de saldo pendiente.
UPDATE [dbo].[Pedidos]
SET
    [subtotal] = COALESCE([total], 0),
    [descuentoTotal] = 0,
    [propinaTotal] = 0,
    [totalPagado] = CASE WHEN [estado] = 'Pagado' THEN COALESCE([total], 0) ELSE 0 END,
    [saldo] = CASE WHEN [estado] = 'Pagado' THEN 0 ELSE COALESCE([total], 0) END,
    [estadoPago] = CASE WHEN [estado] = 'Pagado' THEN 'Pagado' ELSE 'Pendiente' END;

ALTER TABLE [dbo].[Pedidos] ADD CONSTRAINT [CK_Pedidos_saldo] CHECK ([saldo] >= 0);
ALTER TABLE [dbo].[Pedidos] ADD CONSTRAINT [CK_Pedidos_totalPagado] CHECK ([totalPagado] >= 0);
ALTER TABLE [dbo].[Pedidos] ADD CONSTRAINT [CK_Pedidos_descuentoTotal] CHECK ([descuentoTotal] >= 0);
ALTER TABLE [dbo].[Pedidos] ADD CONSTRAINT [CK_Pedidos_propinaTotal] CHECK ([propinaTotal] >= 0);
ALTER TABLE [dbo].[Pedidos] ADD CONSTRAINT [CK_Pedidos_estadoPago]
    CHECK ([estadoPago] IN ('Pendiente', 'Parcial', 'Pagado', 'Anulado', 'Reembolsado'));

-- Cupones simples de demostración para 4.2.
IF NOT EXISTS (SELECT 1 FROM [dbo].[Cupones] WHERE [codigo] = 'BIENVENIDO10')
BEGIN
    INSERT INTO [dbo].[Cupones] ([codigo], [tipo], [valor], [usosMaximos], [usos], [activo])
    VALUES ('BIENVENIDO10', 'Porcentaje', 10, 1000, 0, 1);
END
IF NOT EXISTS (SELECT 1 FROM [dbo].[Cupones] WHERE [codigo] = 'PROMO20')
BEGIN
    INSERT INTO [dbo].[Cupones] ([codigo], [tipo], [valor], [usosMaximos], [usos], [activo])
    VALUES ('PROMO20', 'Monto', 20, 1000, 0, 1);
END

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
