BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[Insumos] ADD CONSTRAINT [Insumos_unidadBaseId_fkey]
    FOREIGN KEY ([unidadBaseId]) REFERENCES [dbo].[UnidadesMedida]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[InsumoStock] ADD CONSTRAINT [InsumoStock_insumoId_fkey]
    FOREIGN KEY ([insumoId]) REFERENCES [dbo].[Insumos]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[InsumoStock] ADD CONSTRAINT [InsumoStock_almacenId_fkey]
    FOREIGN KEY ([almacenId]) REFERENCES [dbo].[Almacenes]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[Recetas] ADD CONSTRAINT [Recetas_productoId_fkey]
    FOREIGN KEY ([productoId]) REFERENCES [dbo].[Productos]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE [dbo].[RecetaDetalles] ADD CONSTRAINT [RecetaDetalles_recetaId_fkey]
    FOREIGN KEY ([recetaId]) REFERENCES [dbo].[Recetas]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[RecetaDetalles] ADD CONSTRAINT [RecetaDetalles_insumoId_fkey]
    FOREIGN KEY ([insumoId]) REFERENCES [dbo].[Insumos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[InsumoMovimientos] ADD CONSTRAINT [InsumoMovimientos_insumoId_fkey]
    FOREIGN KEY ([insumoId]) REFERENCES [dbo].[Insumos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[InsumoMovimientos] ADD CONSTRAINT [InsumoMovimientos_almacenId_fkey]
    FOREIGN KEY ([almacenId]) REFERENCES [dbo].[Almacenes]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[InsumoMovimientos] ADD CONSTRAINT [InsumoMovimientos_almacenDestinoId_fkey]
    FOREIGN KEY ([almacenDestinoId]) REFERENCES [dbo].[Almacenes]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[Insumos] ADD CONSTRAINT [CK_Insumos_stockMinimo] CHECK ([stockMinimo] >= 0);
ALTER TABLE [dbo].[Insumos] ADD CONSTRAINT [CK_Insumos_puntoRecompra] CHECK ([puntoRecompra] >= 0);
ALTER TABLE [dbo].[Insumos] ADD CONSTRAINT [CK_Insumos_costoPromedio] CHECK ([costoPromedio] >= 0);
ALTER TABLE [dbo].[Insumos] ADD CONSTRAINT [CK_Insumos_leadTime] CHECK ([leadTimeDias] >= 0);
ALTER TABLE [dbo].[InsumoStock] ADD CONSTRAINT [CK_InsumoStock_cantidad] CHECK ([cantidad] >= 0);
ALTER TABLE [dbo].[Recetas] ADD CONSTRAINT [CK_Recetas_rendimiento] CHECK ([rendimiento] > 0);
ALTER TABLE [dbo].[Recetas] ADD CONSTRAINT [CK_Recetas_merma] CHECK ([mermaPorcentaje] >= 0 AND [mermaPorcentaje] <= 100);
ALTER TABLE [dbo].[RecetaDetalles] ADD CONSTRAINT [CK_RecetaDetalles_cantidad] CHECK ([cantidad] > 0);
ALTER TABLE [dbo].[Pedido_Detalles] ADD CONSTRAINT [CK_Pedido_Detalles_costoUnitario]
    CHECK ([costoUnitario] IS NULL OR [costoUnitario] >= 0);
ALTER TABLE [dbo].[Pedido_Detalles] ADD CONSTRAINT [CK_Pedido_Detalles_costoTotal]
    CHECK ([costoTotal] IS NULL OR [costoTotal] >= 0);

IF NOT EXISTS (SELECT 1 FROM [dbo].[UnidadesMedida] WHERE [codigo] = 'g')
    INSERT INTO [dbo].[UnidadesMedida] ([codigo], [nombre], [tipo], [factorBase], [activo])
    VALUES ('g', 'Gramo', 'PESO', 1, 1);
IF NOT EXISTS (SELECT 1 FROM [dbo].[UnidadesMedida] WHERE [codigo] = 'kg')
    INSERT INTO [dbo].[UnidadesMedida] ([codigo], [nombre], [tipo], [factorBase], [activo])
    VALUES ('kg', 'Kilogramo', 'PESO', 1000, 1);
IF NOT EXISTS (SELECT 1 FROM [dbo].[UnidadesMedida] WHERE [codigo] = 'ml')
    INSERT INTO [dbo].[UnidadesMedida] ([codigo], [nombre], [tipo], [factorBase], [activo])
    VALUES ('ml', 'Mililitro', 'VOLUMEN', 1, 1);
IF NOT EXISTS (SELECT 1 FROM [dbo].[UnidadesMedida] WHERE [codigo] = 'l')
    INSERT INTO [dbo].[UnidadesMedida] ([codigo], [nombre], [tipo], [factorBase], [activo])
    VALUES ('l', 'Litro', 'VOLUMEN', 1000, 1);
IF NOT EXISTS (SELECT 1 FROM [dbo].[UnidadesMedida] WHERE [codigo] = 'unidad')
    INSERT INTO [dbo].[UnidadesMedida] ([codigo], [nombre], [tipo], [factorBase], [activo])
    VALUES ('unidad', 'Unidad', 'UNIDAD', 1, 1);

IF NOT EXISTS (SELECT 1 FROM [dbo].[Almacenes] WHERE [codigo] = 'ALMACEN')
    INSERT INTO [dbo].[Almacenes] ([codigo], [nombre], [tipo], [activo])
    VALUES ('ALMACEN', 'Almacén principal', 'PRINCIPAL', 1);
IF NOT EXISTS (SELECT 1 FROM [dbo].[Almacenes] WHERE [codigo] = 'COCINA')
    INSERT INTO [dbo].[Almacenes] ([codigo], [nombre], [tipo], [activo])
    VALUES ('COCINA', 'Cocina', 'PRODUCCION', 1);
IF NOT EXISTS (SELECT 1 FROM [dbo].[Almacenes] WHERE [codigo] = 'BAR')
    INSERT INTO [dbo].[Almacenes] ([codigo], [nombre], [tipo], [activo])
    VALUES ('BAR', 'Bar', 'PRODUCCION', 1);

IF NOT EXISTS (SELECT 1 FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:read')
    INSERT INTO [dbo].[Permisos] ([codigo], [nombre], [descripcion], [grupo], [createdAt], [updatedAt])
    VALUES ('inventory:read', 'Ver inventario', 'Consultar insumos, recetas y stock.', 'Inventario', GETDATE(), GETDATE());
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:manage')
    INSERT INTO [dbo].[Permisos] ([codigo], [nombre], [descripcion], [grupo], [createdAt], [updatedAt])
    VALUES ('inventory:manage', 'Gestionar inventario', 'Crear insumos, recetas y almacenes.', 'Inventario', GETDATE(), GETDATE());
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:waste')
    INSERT INTO [dbo].[Permisos] ([codigo], [nombre], [descripcion], [grupo], [createdAt], [updatedAt])
    VALUES ('inventory:waste', 'Registrar merma', 'Registrar pérdidas con motivo y responsable.', 'Inventario', GETDATE(), GETDATE());
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:count')
    INSERT INTO [dbo].[Permisos] ([codigo], [nombre], [descripcion], [grupo], [createdAt], [updatedAt])
    VALUES ('inventory:count', 'Realizar conteo', 'Registrar conteos físicos y ajustes.', 'Inventario', GETDATE(), GETDATE());
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:transfer')
    INSERT INTO [dbo].[Permisos] ([codigo], [nombre], [descripcion], [grupo], [createdAt], [updatedAt])
    VALUES ('inventory:transfer', 'Transferir stock', 'Mover insumos entre almacenes.', 'Inventario', GETDATE(), GETDATE());
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:purchase')
    INSERT INTO [dbo].[Permisos] ([codigo], [nombre], [descripcion], [grupo], [createdAt], [updatedAt])
    VALUES ('inventory:purchase', 'Registrar compra', 'Registrar entradas de insumos y costos.', 'Inventario', GETDATE(), GETDATE());
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permisos] WHERE [codigo] = 'costs:read')
    INSERT INTO [dbo].[Permisos] ([codigo], [nombre], [descripcion], [grupo], [createdAt], [updatedAt])
    VALUES ('costs:read', 'Ver costos reales', 'Consultar costos y márgenes reales.', 'Inventario', GETDATE(), GETDATE());

DECLARE @inventoryRead INT = (SELECT [id] FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:read');
DECLARE @inventoryManage INT = (SELECT [id] FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:manage');
DECLARE @inventoryWaste INT = (SELECT [id] FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:waste');
DECLARE @inventoryCount INT = (SELECT [id] FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:count');
DECLARE @inventoryTransfer INT = (SELECT [id] FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:transfer');
DECLARE @inventoryPurchase INT = (SELECT [id] FROM [dbo].[Permisos] WHERE [codigo] = 'inventory:purchase');
DECLARE @costsRead INT = (SELECT [id] FROM [dbo].[Permisos] WHERE [codigo] = 'costs:read');
DECLARE @rolAdmin INT = (SELECT [id] FROM [dbo].[RolesLocal] WHERE [codigo] = 'ADMIN');
DECLARE @rolSupervisor INT = (SELECT [id] FROM [dbo].[RolesLocal] WHERE [codigo] = 'SUPERVISOR');
DECLARE @rolCocina INT = (SELECT [id] FROM [dbo].[RolesLocal] WHERE [codigo] = 'COCINA');

IF @rolAdmin IS NOT NULL
BEGIN
    INSERT INTO [dbo].[RolPermisos] ([rolId], [permisoId])
    SELECT @rolAdmin, p.[id]
    FROM [dbo].[Permisos] p
    WHERE p.[codigo] IN ('inventory:read', 'inventory:manage', 'inventory:waste', 'inventory:count', 'inventory:transfer', 'inventory:purchase', 'costs:read')
      AND NOT EXISTS (SELECT 1 FROM [dbo].[RolPermisos] rp WHERE rp.[rolId] = @rolAdmin AND rp.[permisoId] = p.[id]);
END;

IF @rolSupervisor IS NOT NULL
BEGIN
    INSERT INTO [dbo].[RolPermisos] ([rolId], [permisoId])
    SELECT @rolSupervisor, p.[id]
    FROM [dbo].[Permisos] p
    WHERE p.[codigo] IN ('inventory:read', 'inventory:manage', 'inventory:waste', 'inventory:count', 'inventory:transfer', 'inventory:purchase', 'costs:read')
      AND NOT EXISTS (SELECT 1 FROM [dbo].[RolPermisos] rp WHERE rp.[rolId] = @rolSupervisor AND rp.[permisoId] = p.[id]);
END;

IF @rolCocina IS NOT NULL
BEGIN
    INSERT INTO [dbo].[RolPermisos] ([rolId], [permisoId])
    SELECT @rolCocina, p.[id]
    FROM [dbo].[Permisos] p
    WHERE p.[codigo] IN ('inventory:read', 'inventory:waste', 'inventory:count', 'inventory:transfer')
      AND NOT EXISTS (SELECT 1 FROM [dbo].[RolPermisos] rp WHERE rp.[rolId] = @rolCocina AND rp.[permisoId] = p.[id]);
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
