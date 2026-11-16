BEGIN TRY

BEGIN TRAN;

-- Pedido: totales para pagos parciales, propinas, descuentos y estado de pago.
ALTER TABLE [dbo].[Pedidos] ADD
    [subtotal] DECIMAL(10,2) NOT NULL CONSTRAINT [Pedidos_subtotal_df] DEFAULT 0,
    [descuentoTotal] DECIMAL(10,2) NOT NULL CONSTRAINT [Pedidos_descuentoTotal_df] DEFAULT 0,
    [propinaTotal] DECIMAL(10,2) NOT NULL CONSTRAINT [Pedidos_propinaTotal_df] DEFAULT 0,
    [totalPagado] DECIMAL(10,2) NOT NULL CONSTRAINT [Pedidos_totalPagado_df] DEFAULT 0,
    [saldo] DECIMAL(10,2) NOT NULL CONSTRAINT [Pedidos_saldo_df] DEFAULT 0,
    [estadoPago] NVARCHAR(20) NOT NULL CONSTRAINT [Pedidos_estadoPago_df] DEFAULT 'Pendiente';

-- Turno: propinas, descuentos y devoluciones.
ALTER TABLE [dbo].[TurnosCaja] ADD
    [totalPropinas] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalPropinas_df] DEFAULT 0,
    [totalDescuentos] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalDescuentos_df] DEFAULT 0,
    [totalDevoluciones] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalDevoluciones_df] DEFAULT 0,
    [totalCobrado] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalCobrado_df] DEFAULT 0;

-- Pago: datos de autorización, efectivo recibido, divisiones y anulación.
ALTER TABLE [dbo].[Pagos] ADD
    [codigoAutorizacion] NVARCHAR(100),
    [terminal] NVARCHAR(50),
    [montoRecibido] DECIMAL(10,2),
    [cambio] DECIMAL(10,2),
    [etiqueta] NVARCHAR(50),
    [autorizadoPorId] UNIQUEIDENTIFIER,
    [autorizadoPorNombre] NVARCHAR(150),
    [anuladoPorId] UNIQUEIDENTIFIER,
    [anuladoPorNombre] NVARCHAR(150),
    [anuladoEn] DATETIME2,
    [motivoAnulacion] NVARCHAR(500);

-- El pago ahora también puede estar reembolsado.
ALTER TABLE [dbo].[Pagos] DROP CONSTRAINT [CK_Pagos_estado];
ALTER TABLE [dbo].[Pagos] ADD CONSTRAINT [CK_Pagos_estado]
    CHECK ([estado] IN ('Registrado', 'Conciliado', 'Anulado', 'Reembolsado'));


CREATE TABLE [dbo].[PagoAplicaciones] (
    [id] INT NOT NULL IDENTITY(1,1),
    [pagoId] INT NOT NULL,
    [pedidoDetalleId] INT NOT NULL,
    [cantidad] INT NOT NULL,
    [monto] DECIMAL(10,2) NOT NULL,
    CONSTRAINT [PagoAplicaciones_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PagoAplicaciones_pagoId_pedidoDetalleId_key] UNIQUE NONCLUSTERED ([pagoId],[pedidoDetalleId]),
    CONSTRAINT [CK_PagoAplicaciones_cantidad] CHECK ([cantidad] > 0),
    CONSTRAINT [CK_PagoAplicaciones_monto] CHECK ([monto] >= 0)
);

CREATE TABLE [dbo].[Descuentos] (
    [id] INT NOT NULL IDENTITY(1,1),
    [pedidoId] INT NOT NULL,
    [tipo] NVARCHAR(20) NOT NULL,
    [valor] DECIMAL(10,2) NOT NULL,
    [montoAplicado] DECIMAL(10,2) NOT NULL,
    [motivo] NVARCHAR(300) NOT NULL,
    [cuponId] INT,
    [autorizadoPorId] UNIQUEIDENTIFIER,
    [autorizadoPorNombre] NVARCHAR(150),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Descuentos_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Descuentos_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Descuentos_pedidoId_key] UNIQUE NONCLUSTERED ([pedidoId]),
    CONSTRAINT [CK_Descuentos_monto] CHECK ([montoAplicado] >= 0),
    CONSTRAINT [CK_Descuentos_tipo] CHECK ([tipo] IN ('Porcentaje', 'Monto'))
);

CREATE TABLE [dbo].[Cupones] (
    [id] INT NOT NULL IDENTITY(1,1),
    [codigo] NVARCHAR(50) NOT NULL,
    [tipo] NVARCHAR(20) NOT NULL,
    [valor] DECIMAL(10,2) NOT NULL,
    [validoDesde] DATETIME2,
    [validoHasta] DATETIME2,
    [usosMaximos] INT,
    [usos] INT NOT NULL CONSTRAINT [Cupones_usos_df] DEFAULT 0,
    [activo] BIT NOT NULL CONSTRAINT [Cupones_activo_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Cupones_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Cupones_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Cupones_codigo_key] UNIQUE NONCLUSTERED ([codigo]),
    CONSTRAINT [CK_Cupones_tipo] CHECK ([tipo] IN ('Porcentaje', 'Monto')),
    CONSTRAINT [CK_Cupones_usos] CHECK ([usos] >= 0)
);

CREATE TABLE [dbo].[Devoluciones] (
    [id] INT NOT NULL IDENTITY(1,1),
    [pedidoId] INT NOT NULL,
    [pagoId] INT,
    [turnoId] INT NOT NULL,
    [cajeroId] UNIQUEIDENTIFIER NOT NULL,
    [cajeroNombre] NVARCHAR(150) NOT NULL,
    [metodo] NVARCHAR(30) NOT NULL,
    [monto] DECIMAL(10,2) NOT NULL,
    [propina] DECIMAL(10,2) NOT NULL CONSTRAINT [Devoluciones_propina_df] DEFAULT 0,
    [motivo] NVARCHAR(500) NOT NULL,
    [autorizadoPorId] UNIQUEIDENTIFIER,
    [autorizadoPorNombre] NVARCHAR(150),
    [estado] NVARCHAR(20) NOT NULL CONSTRAINT [Devoluciones_estado_df] DEFAULT 'Registrada',
    [reversionStock] BIT NOT NULL CONSTRAINT [Devoluciones_reversionStock_df] DEFAULT 0,
    [conciliadoEn] DATETIME2,
    [conciliadoPorId] UNIQUEIDENTIFIER,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Devoluciones_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Devoluciones_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CK_Devoluciones_monto] CHECK ([monto] > 0),
    CONSTRAINT [CK_Devoluciones_propina] CHECK ([propina] >= 0),
    CONSTRAINT [CK_Devoluciones_estado] CHECK ([estado] IN ('Registrada', 'Conciliada', 'Anulada'))
);

CREATE TABLE [dbo].[DevolucionDetalles] (
    [id] INT NOT NULL IDENTITY(1,1),
    [devolucionId] INT NOT NULL,
    [pedidoDetalleId] INT,
    [productoId] INT NOT NULL,
    [cantidad] INT NOT NULL,
    [monto] DECIMAL(10,2),
    CONSTRAINT [DevolucionDetalles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CK_DevolucionDetalles_cantidad] CHECK ([cantidad] > 0)
);

CREATE TABLE [dbo].[MovimientosStock] (
    [id] INT NOT NULL IDENTITY(1,1),
    [productoId] INT NOT NULL,
    [cantidad] INT NOT NULL,
    [tipo] NVARCHAR(20) NOT NULL,
    [motivo] NVARCHAR(300),
    [referenciaId] INT,
    [usuarioId] UNIQUEIDENTIFIER,
    [usuarioNombre] NVARCHAR(150),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MovimientosStock_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [MovimientosStock_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CK_MovimientosStock_cantidad] CHECK ([cantidad] > 0)
);

CREATE TABLE [dbo].[Comprobantes] (
    [id] INT NOT NULL IDENTITY(1,1),
    [pedidoId] INT NOT NULL,
    [tipo] NVARCHAR(20) NOT NULL CONSTRAINT [Comprobantes_tipo_df] DEFAULT 'Ticket',
    [monto] DECIMAL(10,2) NOT NULL,
    [estado] NVARCHAR(20) NOT NULL CONSTRAINT [Comprobantes_estado_df] DEFAULT 'Emitido',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Comprobantes_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Comprobantes_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Comprobantes_pedidoId_key] UNIQUE NONCLUSTERED ([pedidoId]),
    CONSTRAINT [CK_Comprobantes_estado] CHECK ([estado] IN ('Emitido', 'Anulado'))
);

CREATE NONCLUSTERED INDEX [PagoAplicaciones_pedidoDetalleId_idx]
    ON [dbo].[PagoAplicaciones]([pedidoDetalleId]);
CREATE NONCLUSTERED INDEX [Descuentos_cuponId_idx]
    ON [dbo].[Descuentos]([cuponId]);
CREATE NONCLUSTERED INDEX [Devoluciones_pedidoId_idx]
    ON [dbo].[Devoluciones]([pedidoId]);
CREATE NONCLUSTERED INDEX [Devoluciones_pagoId_idx]
    ON [dbo].[Devoluciones]([pagoId]);
CREATE NONCLUSTERED INDEX [Devoluciones_turnoId_estado_idx]
    ON [dbo].[Devoluciones]([turnoId], [estado]);
CREATE NONCLUSTERED INDEX [DevolucionDetalles_devolucionId_idx]
    ON [dbo].[DevolucionDetalles]([devolucionId]);
CREATE NONCLUSTERED INDEX [DevolucionDetalles_productoId_idx]
    ON [dbo].[DevolucionDetalles]([productoId]);
CREATE NONCLUSTERED INDEX [MovimientosStock_productoId_createdAt_idx]
    ON [dbo].[MovimientosStock]([productoId], [createdAt]);

ALTER TABLE [dbo].[PagoAplicaciones] ADD CONSTRAINT [FK_PagoAplicaciones_Pagos]
    FOREIGN KEY ([pagoId]) REFERENCES [dbo].[Pagos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PagoAplicaciones] ADD CONSTRAINT [FK_PagoAplicaciones_Detalles]
    FOREIGN KEY ([pedidoDetalleId]) REFERENCES [dbo].[Pedido_Detalles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Descuentos] ADD CONSTRAINT [FK_Descuentos_Pedidos]
    FOREIGN KEY ([pedidoId]) REFERENCES [dbo].[Pedidos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Descuentos] ADD CONSTRAINT [FK_Descuentos_Cupones]
    FOREIGN KEY ([cuponId]) REFERENCES [dbo].[Cupones]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Devoluciones] ADD CONSTRAINT [FK_Devoluciones_Pedidos]
    FOREIGN KEY ([pedidoId]) REFERENCES [dbo].[Pedidos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Devoluciones] ADD CONSTRAINT [FK_Devoluciones_Pagos]
    FOREIGN KEY ([pagoId]) REFERENCES [dbo].[Pagos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Devoluciones] ADD CONSTRAINT [FK_Devoluciones_TurnosCaja]
    FOREIGN KEY ([turnoId]) REFERENCES [dbo].[TurnosCaja]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[DevolucionDetalles] ADD CONSTRAINT [FK_DevolucionDetalles_Devoluciones]
    FOREIGN KEY ([devolucionId]) REFERENCES [dbo].[Devoluciones]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[DevolucionDetalles] ADD CONSTRAINT [FK_DevolucionDetalles_Detalles]
    FOREIGN KEY ([pedidoDetalleId]) REFERENCES [dbo].[Pedido_Detalles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[DevolucionDetalles] ADD CONSTRAINT [FK_DevolucionDetalles_Productos]
    FOREIGN KEY ([productoId]) REFERENCES [dbo].[Productos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[MovimientosStock] ADD CONSTRAINT [FK_MovimientosStock_Productos]
    FOREIGN KEY ([productoId]) REFERENCES [dbo].[Productos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Comprobantes] ADD CONSTRAINT [FK_Comprobantes_Pedidos]
    FOREIGN KEY ([pedidoId]) REFERENCES [dbo].[Pedidos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
