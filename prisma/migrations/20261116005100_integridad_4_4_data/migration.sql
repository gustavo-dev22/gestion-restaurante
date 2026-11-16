BEGIN TRY

BEGIN TRAN;

-- Migrar llamados existentes fuera de Pedidos.
IF EXISTS (
    SELECT 1
    FROM [dbo].[Pedidos] p
    WHERE p.[estado] IN ('Llamado', 'Atendido')
      AND (
          EXISTS (SELECT 1 FROM [dbo].[Pedido_Detalles] d WHERE d.[pedidoId] = p.[id])
          OR EXISTS (SELECT 1 FROM [dbo].[Pagos] pg WHERE pg.[pedidoId] = p.[id])
          OR EXISTS (SELECT 1 FROM [dbo].[Descuentos] ds WHERE ds.[pedidoId] = p.[id])
          OR EXISTS (SELECT 1 FROM [dbo].[Devoluciones] dv WHERE dv.[pedidoId] = p.[id])
          OR EXISTS (SELECT 1 FROM [dbo].[Comprobantes] c WHERE c.[pedidoId] = p.[id])
      )
)
BEGIN
    THROW 50001, 'Existen llamados en Pedidos con datos asociados. Resuélvelos antes de migrar.', 1;
END;

INSERT INTO [dbo].[LlamadosMesero]
    ([mesaId], [usuarioId], [nombreMesero], [estado], [creadoEn], [atendidoEn], [atendidoPorId], [atendidoPorNombre])
SELECT
    p.[mesaId],
    p.[usuarioId],
    p.[nombreMesero],
    CASE WHEN p.[estado] = 'Atendido' THEN 'ATENDIDO' ELSE 'PENDIENTE' END,
    COALESCE(p.[fecha_creacion], CURRENT_TIMESTAMP),
    CASE WHEN p.[estado] = 'Atendido' THEN COALESCE(p.[fecha_creacion], CURRENT_TIMESTAMP) END,
    CASE WHEN p.[estado] = 'Atendido' THEN p.[usuarioId] END,
    CASE WHEN p.[estado] = 'Atendido' THEN p.[nombreMesero] END
FROM [dbo].[Pedidos] p
WHERE p.[estado] IN ('Llamado', 'Atendido');

DELETE FROM [dbo].[Pedidos]
WHERE [estado] IN ('Llamado', 'Atendido');

-- Normalizar estados de detalle.
UPDATE [dbo].[Pedido_Detalles]
SET [estado] = CASE
    WHEN [estado] IS NULL THEN 'PENDIENTE'
    WHEN [estado] = 'Listo' THEN 'LISTO'
    WHEN [estado] = 'Pendiente' THEN 'PENDIENTE'
    ELSE [estado]
END;

-- Normalizar estados de pedido.
UPDATE p
SET
    [estado] = CASE
        WHEN p.[estado] IS NULL THEN 'BORRADOR'
        WHEN p.[estado] = 'Por Confirmar' THEN 'BORRADOR'
        WHEN p.[estado] = 'Pagado' THEN 'PAGADO'
        WHEN p.[estado] = 'Expirado' THEN 'ANULADO'
        WHEN p.[estado] = 'Pendiente' THEN
            CASE
                WHEN NOT EXISTS (
                    SELECT 1 FROM [dbo].[Pedido_Detalles] d WHERE d.[pedidoId] = p.[id]
                ) THEN 'CONFIRMADO'
                WHEN NOT EXISTS (
                    SELECT 1 FROM [dbo].[Pedido_Detalles] d
                    WHERE d.[pedidoId] = p.[id] AND d.[estado] <> 'LISTO'
                ) THEN 'LISTO'
                WHEN EXISTS (
                    SELECT 1 FROM [dbo].[Pedido_Detalles] d
                    WHERE d.[pedidoId] = p.[id] AND d.[estado] = 'LISTO'
                ) THEN 'PARCIALMENTE_LISTO'
                ELSE 'CONFIRMADO'
            END
        ELSE p.[estado]
    END,
    [motivoAnulacion] = CASE
        WHEN p.[estado] = 'Expirado' THEN 'Pedido QR expirado'
        ELSE p.[motivoAnulacion]
    END,
    [anuladoEn] = CASE
        WHEN p.[estado] = 'Expirado' THEN COALESCE(p.[fecha_creacion], CURRENT_TIMESTAMP)
        ELSE p.[anuladoEn]
    END
FROM [dbo].[Pedidos] p
WHERE p.[estado] IN ('Por Confirmar', 'Pendiente', 'Pagado', 'Expirado') OR p.[estado] IS NULL;

UPDATE [dbo].[Pedidos]
SET [total] = 0
WHERE [total] IS NULL;

UPDATE [dbo].[Reservas]
SET [franjaInicio] = DATEADD(
    MINUTE,
    (DATEDIFF(MINUTE, CAST('2000-01-01' AS datetime), [fechaReserva]) / 120) * 120,
    CAST('2000-01-01' AS datetime)
)
WHERE [franjaInicio] IS NULL;

ALTER TABLE [dbo].[Pedidos] ALTER COLUMN [total] DECIMAL(10,2) NOT NULL;
ALTER TABLE [dbo].[Pedidos] ALTER COLUMN [estado] NVARCHAR(30) NOT NULL;
ALTER TABLE [dbo].[Pedido_Detalles] ALTER COLUMN [estado] NVARCHAR(20) NOT NULL;
ALTER TABLE [dbo].[Reservas] ALTER COLUMN [franjaInicio] DATETIME2 NOT NULL;

-- Índices y relaciones de las tablas nuevas.
CREATE NONCLUSTERED INDEX [LlamadosMesero_mesaId_estado_creadoEn_idx]
    ON [dbo].[LlamadosMesero]([mesaId], [estado], [creadoEn]);

ALTER TABLE [dbo].[LlamadosMesero] ADD CONSTRAINT [LlamadosMesero_mesaId_fkey]
    FOREIGN KEY ([mesaId]) REFERENCES [dbo].[Mesas]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [ProductoPrecioHistorial_productoId_createdAt_idx]
    ON [dbo].[ProductoPrecioHistorial]([productoId], [createdAt]);

ALTER TABLE [dbo].[ProductoPrecioHistorial] ADD CONSTRAINT [ProductoPrecioHistorial_productoId_fkey]
    FOREIGN KEY ([productoId]) REFERENCES [dbo].[Productos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Restricciones de integridad.
ALTER TABLE [dbo].[Productos] ADD CONSTRAINT [CK_Productos_precio] CHECK ([precio] >= 0);
ALTER TABLE [dbo].[Productos] ADD CONSTRAINT [CK_Productos_stock] CHECK ([stock] IS NULL OR [stock] >= 0);

ALTER TABLE [dbo].[Pedidos] ADD CONSTRAINT [CK_Pedidos_totales] CHECK (
    [total] >= 0 AND [subtotal] >= 0 AND [descuentoTotal] >= 0
    AND [propinaTotal] >= 0 AND [totalPagado] >= 0 AND [saldo] >= 0
);
ALTER TABLE [dbo].[Pedidos] ADD CONSTRAINT [CK_Pedidos_estado] CHECK (
    [estado] IN (
        'BORRADOR', 'CONFIRMADO', 'EN_COCINA', 'PARCIALMENTE_LISTO',
        'LISTO', 'SERVIDO', 'POR_COBRAR', 'PAGADO', 'CERRADO', 'ANULADO'
    )
);

ALTER TABLE [dbo].[Pedido_Detalles] ADD CONSTRAINT [CK_Pedido_Detalles_cantidad] CHECK ([cantidad] > 0);
ALTER TABLE [dbo].[Pedido_Detalles] ADD CONSTRAINT [CK_Pedido_Detalles_precio] CHECK ([precio_unitario] >= 0);
ALTER TABLE [dbo].[Pedido_Detalles] ADD CONSTRAINT [CK_Pedido_Detalles_estado] CHECK (
    [estado] IN ('PENDIENTE', 'EN_PREPARACION', 'LISTO', 'SERVIDO')
);

ALTER TABLE [dbo].[Pagos] ADD CONSTRAINT [CK_Pagos_propina_4_4] CHECK ([propina] >= 0);

ALTER TABLE [dbo].[Reservas] ADD CONSTRAINT [CK_Reservas_numPersonas] CHECK ([numPersonas] > 0);
ALTER TABLE [dbo].[Reservas] ADD CONSTRAINT [CK_Reservas_estado] CHECK (
    [estado] IN ('Confirmada', 'Finalizada', 'Cancelada')
);
CREATE UNIQUE INDEX [UX_Reservas_Mesa_Franja]
    ON [dbo].[Reservas]([mesaId], [franjaInicio])
    WHERE [estado] = 'Confirmada';

-- Backfill de historial de precios.
INSERT INTO [dbo].[ProductoPrecioHistorial]
    ([productoId], [precioAnterior], [precioNuevo], [motivo], [usuarioNombre])
SELECT p.[id], NULL, p.[precio], 'Migración 4.4', 'Sistema'
FROM [dbo].[Productos] p
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[ProductoPrecioHistorial] h WHERE h.[productoId] = p.[id]
);

-- Nuevos permisos locales y asignación a roles existentes.
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permisos] WHERE [codigo] = 'orders:prepare')
BEGIN
    INSERT INTO [dbo].[Permisos] ([codigo], [nombre], [descripcion], [grupo], [createdAt], [updatedAt])
    VALUES ('orders:prepare', 'Iniciar preparación', 'Iniciar y completar la preparación de platos.', 'Pedidos', GETDATE(), GETDATE());
END;

IF NOT EXISTS (SELECT 1 FROM [dbo].[Permisos] WHERE [codigo] = 'orders:serve')
BEGIN
    INSERT INTO [dbo].[Permisos] ([codigo], [nombre], [descripcion], [grupo], [createdAt], [updatedAt])
    VALUES ('orders:serve', 'Servir y atender mesas', 'Marcar pedidos servidos y atender llamados.', 'Pedidos', GETDATE(), GETDATE());
END;

DECLARE @permisoPrepare INT = (SELECT [id] FROM [dbo].[Permisos] WHERE [codigo] = 'orders:prepare');
DECLARE @permisoServe INT = (SELECT [id] FROM [dbo].[Permisos] WHERE [codigo] = 'orders:serve');
DECLARE @rolAdmin INT = (SELECT [id] FROM [dbo].[RolesLocal] WHERE [codigo] = 'ADMIN');
DECLARE @rolSupervisor INT = (SELECT [id] FROM [dbo].[RolesLocal] WHERE [codigo] = 'SUPERVISOR');
DECLARE @rolCocina INT = (SELECT [id] FROM [dbo].[RolesLocal] WHERE [codigo] = 'COCINA');
DECLARE @rolMesero INT = (SELECT [id] FROM [dbo].[RolesLocal] WHERE [codigo] = 'MESERO');

IF @permisoPrepare IS NOT NULL AND @rolAdmin IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM [dbo].[RolPermisos] WHERE [rolId] = @rolAdmin AND [permisoId] = @permisoPrepare)
    INSERT INTO [dbo].[RolPermisos] ([rolId], [permisoId]) VALUES (@rolAdmin, @permisoPrepare);

IF @permisoServe IS NOT NULL AND @rolAdmin IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM [dbo].[RolPermisos] WHERE [rolId] = @rolAdmin AND [permisoId] = @permisoServe)
    INSERT INTO [dbo].[RolPermisos] ([rolId], [permisoId]) VALUES (@rolAdmin, @permisoServe);

IF @permisoPrepare IS NOT NULL AND @rolSupervisor IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM [dbo].[RolPermisos] WHERE [rolId] = @rolSupervisor AND [permisoId] = @permisoPrepare)
    INSERT INTO [dbo].[RolPermisos] ([rolId], [permisoId]) VALUES (@rolSupervisor, @permisoPrepare);

IF @permisoServe IS NOT NULL AND @rolSupervisor IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM [dbo].[RolPermisos] WHERE [rolId] = @rolSupervisor AND [permisoId] = @permisoServe)
    INSERT INTO [dbo].[RolPermisos] ([rolId], [permisoId]) VALUES (@rolSupervisor, @permisoServe);

IF @permisoPrepare IS NOT NULL AND @rolCocina IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM [dbo].[RolPermisos] WHERE [rolId] = @rolCocina AND [permisoId] = @permisoPrepare)
    INSERT INTO [dbo].[RolPermisos] ([rolId], [permisoId]) VALUES (@rolCocina, @permisoPrepare);

IF @permisoServe IS NOT NULL AND @rolMesero IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM [dbo].[RolPermisos] WHERE [rolId] = @rolMesero AND [permisoId] = @permisoServe)
    INSERT INTO [dbo].[RolPermisos] ([rolId], [permisoId]) VALUES (@rolMesero, @permisoServe);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
