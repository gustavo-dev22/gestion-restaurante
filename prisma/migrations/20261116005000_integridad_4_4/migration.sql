BEGIN TRY

BEGIN TRAN;

-- Soft delete en entidades maestras.
ALTER TABLE [dbo].[Categorias] ADD
    [eliminadoEn] DATETIME2 NULL,
    [eliminadoPorId] NVARCHAR(100) NULL,
    [eliminadoPorNombre] NVARCHAR(150) NULL,
    [motivoEliminacion] NVARCHAR(300) NULL;

ALTER TABLE [dbo].[Productos] ADD
    [eliminadoEn] DATETIME2 NULL,
    [eliminadoPorId] NVARCHAR(100) NULL,
    [eliminadoPorNombre] NVARCHAR(150) NULL,
    [motivoEliminacion] NVARCHAR(300) NULL;

ALTER TABLE [dbo].[Mesas] ADD
    [eliminadoEn] DATETIME2 NULL,
    [eliminadoPorId] NVARCHAR(100) NULL,
    [eliminadoPorNombre] NVARCHAR(150) NULL,
    [motivoEliminacion] NVARCHAR(300) NULL;

ALTER TABLE [dbo].[Cupones] ADD
    [eliminadoEn] DATETIME2 NULL,
    [eliminadoPorId] NVARCHAR(100) NULL,
    [eliminadoPorNombre] NVARCHAR(150) NULL,
    [motivoEliminacion] NVARCHAR(300) NULL;

-- Datos de anulación/cierre de pedidos.
ALTER TABLE [dbo].[Pedidos] ADD
    [motivoAnulacion] NVARCHAR(500) NULL,
    [anuladoEn] DATETIME2 NULL,
    [anuladoPorId] NVARCHAR(100) NULL,
    [anuladoPorNombre] NVARCHAR(150) NULL,
    [cerradoEn] DATETIME2 NULL;

-- Franja de reserva de 2 horas.
ALTER TABLE [dbo].[Reservas] ADD
    [franjaInicio] DATETIME2 NULL;

-- Idempotencia reforzada.
ALTER TABLE [dbo].[Idempotency_Keys] ADD
    [scope] NVARCHAR(150) NOT NULL CONSTRAINT [Idempotency_Keys_scope_df] DEFAULT 'legacy',
    [requestHash] NVARCHAR(64) NULL;

-- Llamados separados de Pedido.
CREATE TABLE [dbo].[LlamadosMesero] (
    [id] INT NOT NULL IDENTITY(1,1),
    [mesaId] INT NOT NULL,
    [usuarioId] UNIQUEIDENTIFIER NULL,
    [nombreMesero] NVARCHAR(100) NULL,
    [estado] NVARCHAR(20) NOT NULL CONSTRAINT [LlamadosMesero_estado_df] DEFAULT 'PENDIENTE',
    [creadoEn] DATETIME2 NOT NULL CONSTRAINT [LlamadosMesero_creadoEn_df] DEFAULT CURRENT_TIMESTAMP,
    [atendidoEn] DATETIME2 NULL,
    [atendidoPorId] UNIQUEIDENTIFIER NULL,
    [atendidoPorNombre] NVARCHAR(150) NULL,
    CONSTRAINT [LlamadosMesero_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CK_LlamadosMesero_estado] CHECK ([estado] IN ('PENDIENTE', 'ATENDIDO'))
);

-- Historial de precios.
CREATE TABLE [dbo].[ProductoPrecioHistorial] (
    [id] INT NOT NULL IDENTITY(1,1),
    [productoId] INT NOT NULL,
    [precioAnterior] DECIMAL(10,2) NULL,
    [precioNuevo] DECIMAL(10,2) NOT NULL,
    [motivo] NVARCHAR(300) NULL,
    [usuarioId] NVARCHAR(100) NULL,
    [usuarioNombre] NVARCHAR(150) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductoPrecioHistorial_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ProductoPrecioHistorial_pkey] PRIMARY KEY CLUSTERED ([id])
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
