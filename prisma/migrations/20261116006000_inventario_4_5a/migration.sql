BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[Productos] ADD
    [tipoInventario] NVARCHAR(20) NOT NULL
        CONSTRAINT [Productos_tipoInventario_df] DEFAULT 'DIRECTO';

ALTER TABLE [dbo].[Pedidos] ADD
    [inventarioConsumido] BIT NOT NULL
        CONSTRAINT [Pedidos_inventarioConsumido_df] DEFAULT 0,
    [inventarioConsumidoEn] DATETIME2 NULL;

ALTER TABLE [dbo].[Pedido_Detalles] ADD
    [costoUnitario] DECIMAL(14,4) NULL,
    [costoTotal] DECIMAL(14,4) NULL;

CREATE TABLE [dbo].[UnidadesMedida] (
    [id] INT NOT NULL IDENTITY(1,1),
    [codigo] NVARCHAR(20) NOT NULL,
    [nombre] NVARCHAR(100) NOT NULL,
    [tipo] NVARCHAR(20) NOT NULL,
    [factorBase] DECIMAL(18,6) NOT NULL CONSTRAINT [UnidadesMedida_factorBase_df] DEFAULT 1,
    [activo] BIT NOT NULL CONSTRAINT [UnidadesMedida_activo_df] DEFAULT 1,
    CONSTRAINT [UnidadesMedida_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UnidadesMedida_codigo_key] UNIQUE NONCLUSTERED ([codigo])
);

CREATE TABLE [dbo].[Almacenes] (
    [id] INT NOT NULL IDENTITY(1,1),
    [codigo] NVARCHAR(30) NOT NULL,
    [nombre] NVARCHAR(100) NOT NULL,
    [tipo] NVARCHAR(20) NOT NULL,
    [activo] BIT NOT NULL CONSTRAINT [Almacenes_activo_df] DEFAULT 1,
    CONSTRAINT [Almacenes_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Almacenes_codigo_key] UNIQUE NONCLUSTERED ([codigo])
);

CREATE TABLE [dbo].[Insumos] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(150) NOT NULL,
    [unidadBaseId] INT NOT NULL,
    [stockMinimo] DECIMAL(14,3) NOT NULL CONSTRAINT [Insumos_stockMinimo_df] DEFAULT 0,
    [puntoRecompra] DECIMAL(14,3) NOT NULL CONSTRAINT [Insumos_puntoRecompra_df] DEFAULT 0,
    [leadTimeDias] INT NOT NULL CONSTRAINT [Insumos_leadTimeDias_df] DEFAULT 0,
    [costoPromedio] DECIMAL(14,4) NOT NULL CONSTRAINT [Insumos_costoPromedio_df] DEFAULT 0,
    [activo] BIT NOT NULL CONSTRAINT [Insumos_activo_df] DEFAULT 1,
    [eliminadoEn] DATETIME2 NULL,
    [eliminadoPorId] NVARCHAR(100) NULL,
    [eliminadoPorNombre] NVARCHAR(150) NULL,
    [motivoEliminacion] NVARCHAR(300) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Insumos_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [Insumos_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Insumos_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [Insumos_activo_idx]
    ON [dbo].[Insumos]([activo]);

CREATE TABLE [dbo].[InsumoStock] (
    [insumoId] INT NOT NULL,
    [almacenId] INT NOT NULL,
    [cantidad] DECIMAL(14,3) NOT NULL CONSTRAINT [InsumoStock_cantidad_df] DEFAULT 0,
    CONSTRAINT [InsumoStock_pkey] PRIMARY KEY CLUSTERED ([insumoId], [almacenId])
);

CREATE NONCLUSTERED INDEX [InsumoStock_almacenId_idx]
    ON [dbo].[InsumoStock]([almacenId]);

CREATE TABLE [dbo].[Recetas] (
    [id] INT NOT NULL IDENTITY(1,1),
    [productoId] INT NOT NULL,
    [rendimiento] DECIMAL(10,3) NOT NULL CONSTRAINT [Recetas_rendimiento_df] DEFAULT 1,
    [mermaPorcentaje] DECIMAL(5,2) NOT NULL CONSTRAINT [Recetas_mermaPorcentaje_df] DEFAULT 0,
    [activo] BIT NOT NULL CONSTRAINT [Recetas_activo_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Recetas_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [Recetas_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Recetas_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Recetas_productoId_key] UNIQUE NONCLUSTERED ([productoId])
);

CREATE TABLE [dbo].[RecetaDetalles] (
    [id] INT NOT NULL IDENTITY(1,1),
    [recetaId] INT NOT NULL,
    [insumoId] INT NOT NULL,
    [cantidad] DECIMAL(14,3) NOT NULL,
    CONSTRAINT [RecetaDetalles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RecetaDetalles_recetaId_insumoId_key] UNIQUE NONCLUSTERED ([recetaId], [insumoId])
);

CREATE NONCLUSTERED INDEX [RecetaDetalles_insumoId_idx]
    ON [dbo].[RecetaDetalles]([insumoId]);

CREATE TABLE [dbo].[InsumoMovimientos] (
    [id] INT NOT NULL IDENTITY(1,1),
    [insumoId] INT NOT NULL,
    [almacenId] INT NOT NULL,
    [almacenDestinoId] INT NULL,
    [tipo] NVARCHAR(30) NOT NULL,
    [cantidad] DECIMAL(14,3) NOT NULL,
    [costoUnitario] DECIMAL(14,4) NOT NULL CONSTRAINT [InsumoMovimientos_costoUnitario_df] DEFAULT 0,
    [costoTotal] DECIMAL(14,4) NOT NULL CONSTRAINT [InsumoMovimientos_costoTotal_df] DEFAULT 0,
    [motivo] NVARCHAR(300) NULL,
    [responsableId] NVARCHAR(100) NULL,
    [responsableNombre] NVARCHAR(150) NULL,
    [referenciaTipo] NVARCHAR(30) NULL,
    [referenciaId] INT NULL,
    [pedidoId] INT NULL,
    [pedidoDetalleId] INT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InsumoMovimientos_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [InsumoMovimientos_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CK_InsumoMovimientos_tipo] CHECK (
        [tipo] IN ('COMPRA', 'CONSUMO', 'MERMA', 'AJUSTE', 'TRANSFERENCIA', 'CONTEO')
    )
);

CREATE NONCLUSTERED INDEX [InsumoMovimientos_insumoId_createdAt_idx]
    ON [dbo].[InsumoMovimientos]([insumoId], [createdAt]);
CREATE NONCLUSTERED INDEX [InsumoMovimientos_almacenId_createdAt_idx]
    ON [dbo].[InsumoMovimientos]([almacenId], [createdAt]);
CREATE NONCLUSTERED INDEX [InsumoMovimientos_pedidoId_idx]
    ON [dbo].[InsumoMovimientos]([pedidoId]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
