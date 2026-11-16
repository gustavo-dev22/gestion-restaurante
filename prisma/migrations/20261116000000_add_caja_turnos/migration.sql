BEGIN TRY

BEGIN TRAN;

-- Fecha de pago del pedido (los pedidos históricos se completan más abajo).
ALTER TABLE [dbo].[Pedidos] ADD [pagadoEn] DATETIME2;

CREATE TABLE [dbo].[TurnosCaja] (
    [id] INT NOT NULL IDENTITY(1,1),
    [cajeroId] UNIQUEIDENTIFIER NOT NULL,
    [cajeroNombre] NVARCHAR(150) NOT NULL,
    [estado] NVARCHAR(20) NOT NULL CONSTRAINT [TurnosCaja_estado_df] DEFAULT 'Abierto',
    [abiertoEn] DATETIME2 NOT NULL CONSTRAINT [TurnosCaja_abiertoEn_df] DEFAULT CURRENT_TIMESTAMP,
    [cerradoEn] DATETIME2,
    [fondoInicial] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_fondoInicial_df] DEFAULT 0,
    [totalEfectivo] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalEfectivo_df] DEFAULT 0,
    [totalTarjeta] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalTarjeta_df] DEFAULT 0,
    [totalBilleteras] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalBilleteras_df] DEFAULT 0,
    [totalOtros] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalOtros_df] DEFAULT 0,
    [totalVentas] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalVentas_df] DEFAULT 0,
    [totalIngresos] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalIngresos_df] DEFAULT 0,
    [totalRetiros] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalRetiros_df] DEFAULT 0,
    [totalGastos] DECIMAL(10,2) NOT NULL CONSTRAINT [TurnosCaja_totalGastos_df] DEFAULT 0,
    [efectivoEsperado] DECIMAL(10,2),
    [efectivoContado] DECIMAL(10,2),
    [diferencia] DECIMAL(10,2),
    [justificacion] NVARCHAR(500),
    [cerradoPorId] UNIQUEIDENTIFIER,
    [cerradoPorNombre] NVARCHAR(150),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TurnosCaja_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TurnosCaja_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CK_TurnosCaja_fondoInicial] CHECK ([fondoInicial] >= 0),
    CONSTRAINT [CK_TurnosCaja_efectivoContado] CHECK ([efectivoContado] IS NULL OR [efectivoContado] >= 0),
    CONSTRAINT [CK_TurnosCaja_estado] CHECK ([estado] IN ('Abierto', 'Cerrado'))
);

CREATE TABLE [dbo].[Pagos] (
    [id] INT NOT NULL IDENTITY(1,1),
    [pedidoId] INT NOT NULL,
    [turnoId] INT,
    [cajeroId] UNIQUEIDENTIFIER,
    [cajeroNombre] NVARCHAR(150),
    [metodo] NVARCHAR(30) NOT NULL,
    [monto] DECIMAL(10,2) NOT NULL,
    [propina] DECIMAL(10,2) NOT NULL CONSTRAINT [Pagos_propina_df] DEFAULT 0,
    [descuento] DECIMAL(10,2) NOT NULL CONSTRAINT [Pagos_descuento_df] DEFAULT 0,
    [referencia] NVARCHAR(100),
    [estado] NVARCHAR(20) NOT NULL CONSTRAINT [Pagos_estado_df] DEFAULT 'Registrado',
    [origen] NVARCHAR(20) NOT NULL CONSTRAINT [Pagos_origen_df] DEFAULT 'POS',
    [conciliadoEn] DATETIME2,
    [conciliadoPorId] UNIQUEIDENTIFIER,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Pagos_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Pagos_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CK_Pagos_monto] CHECK ([monto] > 0),
    CONSTRAINT [CK_Pagos_metodo] CHECK ([metodo] IN ('Efectivo', 'Tarjeta', 'Yape/Plin', 'Otro')),
    CONSTRAINT [CK_Pagos_estado] CHECK ([estado] IN ('Registrado', 'Conciliado', 'Anulado')),
    CONSTRAINT [CK_Pagos_origen] CHECK ([origen] IN ('POS', 'Legacy'))
);

CREATE TABLE [dbo].[MovimientosCaja] (
    [id] INT NOT NULL IDENTITY(1,1),
    [turnoId] INT NOT NULL,
    [tipo] NVARCHAR(20) NOT NULL,
    [monto] DECIMAL(10,2) NOT NULL,
    [motivo] NVARCHAR(300) NOT NULL,
    [usuarioId] UNIQUEIDENTIFIER NOT NULL,
    [usuarioNombre] NVARCHAR(150) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MovimientosCaja_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [MovimientosCaja_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CK_MovimientosCaja_monto] CHECK ([monto] > 0),
    CONSTRAINT [CK_MovimientosCaja_tipo] CHECK ([tipo] IN ('Retiro', 'Gasto', 'Ingreso'))
);

CREATE TABLE [dbo].[CajaEventos] (
    [id] INT NOT NULL IDENTITY(1,1),
    [turnoId] INT NOT NULL,
    [tipo] NVARCHAR(30) NOT NULL,
    [detalle] NVARCHAR(max),
    [monto] DECIMAL(10,2),
    [usuarioId] UNIQUEIDENTIFIER,
    [usuarioNombre] NVARCHAR(150),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CajaEventos_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CajaEventos_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [TurnosCaja_estado_abiertoEn_idx]
    ON [dbo].[TurnosCaja]([estado], [abiertoEn]);

CREATE UNIQUE INDEX [IX_TurnosCaja_UnicoAbierto]
    ON [dbo].[TurnosCaja]([estado])
    WHERE [estado] = 'Abierto';

CREATE NONCLUSTERED INDEX [Pagos_turnoId_estado_idx]
    ON [dbo].[Pagos]([turnoId], [estado]);

CREATE NONCLUSTERED INDEX [Pagos_pedidoId_idx]
    ON [dbo].[Pagos]([pedidoId]);

CREATE NONCLUSTERED INDEX [Pagos_createdAt_idx]
    ON [dbo].[Pagos]([createdAt]);

CREATE NONCLUSTERED INDEX [MovimientosCaja_turnoId_createdAt_idx]
    ON [dbo].[MovimientosCaja]([turnoId], [createdAt]);

CREATE NONCLUSTERED INDEX [CajaEventos_turnoId_createdAt_idx]
    ON [dbo].[CajaEventos]([turnoId], [createdAt]);

ALTER TABLE [dbo].[Pagos] ADD CONSTRAINT [FK_Pagos_Pedidos]
    FOREIGN KEY ([pedidoId]) REFERENCES [dbo].[Pedidos]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[Pagos] ADD CONSTRAINT [FK_Pagos_TurnosCaja]
    FOREIGN KEY ([turnoId]) REFERENCES [dbo].[TurnosCaja]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[MovimientosCaja] ADD CONSTRAINT [FK_MovimientosCaja_TurnosCaja]
    FOREIGN KEY ([turnoId]) REFERENCES [dbo].[TurnosCaja]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[CajaEventos] ADD CONSTRAINT [FK_CajaEventos_TurnosCaja]
    FOREIGN KEY ([turnoId]) REFERENCES [dbo].[TurnosCaja]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
