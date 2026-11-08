BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Categorias] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(100) NOT NULL,
    [descripcion] NVARCHAR(255),
    [icono] NVARCHAR(50),
    [activo] BIT CONSTRAINT [DF__Categoria__activ__37A5467C] DEFAULT 1,
    [fecha_creacion] DATETIME2 CONSTRAINT [DF__Categoria__fecha__38996AB5] DEFAULT GETDATE(),
    [area] VARCHAR(20) CONSTRAINT [DF__Categorias__area__5EBF139D] DEFAULT 'Cocina',
    CONSTRAINT [PK__Categori__3213E83F70DA985B] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Productos] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(150) NOT NULL,
    [descripcion] NVARCHAR(max),
    [precio] DECIMAL(10,2) NOT NULL,
    [imagen_url] NVARCHAR(max),
    [stock] INT CONSTRAINT [DF__Productos__stock__3B75D760] DEFAULT 0,
    [categoriaId] INT NOT NULL,
    [activo] BIT CONSTRAINT [DF__Productos__activ__3C69FB99] DEFAULT 1,
    [fecha_creacion] DATETIME2 CONSTRAINT [DF__Productos__fecha__3D5E1FD2] DEFAULT GETDATE(),
    CONSTRAINT [PK__Producto__3213E83F276ADAA2] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Mesas] (
    [id] INT NOT NULL IDENTITY(1,1),
    [numero] NVARCHAR(20) NOT NULL,
    [capacidad] INT CONSTRAINT [DF__Mesas__capacidad__412EB0B6] DEFAULT 2,
    [zona] NVARCHAR(50),
    [estado] NVARCHAR(20) CONSTRAINT [DF__Mesas__estado__4222D4EF] DEFAULT 'Libre',
    [activo] BIT CONSTRAINT [DF__Mesas__activo__4316F928] DEFAULT 1,
    [fecha_creacion] DATETIME2 CONSTRAINT [DF__Mesas__fecha_cre__440B1D61] DEFAULT GETDATE(),
    CONSTRAINT [PK__Mesas__3213E83F474B4572] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Pedidos] (
    [id] INT NOT NULL IDENTITY(1,1),
    [mesaId] INT NOT NULL,
    [usuarioId] UNIQUEIDENTIFIER,
    [total] DECIMAL(10,2) CONSTRAINT [DF__Pedidos__total__46E78A0C] DEFAULT 0.00,
    [estado] NVARCHAR(20) CONSTRAINT [DF__Pedidos__estado__47DBAE45] DEFAULT 'Pendiente',
    [fecha_creacion] DATETIME2 CONSTRAINT [DF__Pedidos__fecha_c__48CFD27E] DEFAULT GETDATE(),
    [nombreMesero] NVARCHAR(100),
    [metodoPago] NVARCHAR(30),
    CONSTRAINT [PK__Pedidos__3213E83F1137F0B1] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Pedido_Detalles] (
    [id] INT NOT NULL IDENTITY(1,1),
    [pedidoId] INT NOT NULL,
    [productoId] INT NOT NULL,
    [cantidad] INT NOT NULL,
    [precio_unitario] DECIMAL(10,2) NOT NULL,
    [estado] VARCHAR(20),
    CONSTRAINT [PK__Pedido_D__3213E83F64EC93C8] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Reservas] (
    [id] INT NOT NULL IDENTITY(1,1),
    [clienteNombre] NVARCHAR(100) NOT NULL,
    [clienteTelefono] NVARCHAR(20) NOT NULL,
    [fechaReserva] DATETIME NOT NULL,
    [numPersonas] INT NOT NULL,
    [mesaId] INT NOT NULL,
    [estado] NVARCHAR(1000) NOT NULL CONSTRAINT [Reservas_estado_df] DEFAULT 'Confirmada',
    [fecha_creacion] DATETIME NOT NULL CONSTRAINT [Reservas_fecha_creacion_df] DEFAULT GETDATE(),
    CONSTRAINT [Reservas_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[Productos] ADD CONSTRAINT [FK_Productos_Categorias] FOREIGN KEY ([categoriaId]) REFERENCES [dbo].[Categorias]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Pedidos] ADD CONSTRAINT [FK_Pedidos_Mesas] FOREIGN KEY ([mesaId]) REFERENCES [dbo].[Mesas]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Pedido_Detalles] ADD CONSTRAINT [FK_Detalle_Pedido] FOREIGN KEY ([pedidoId]) REFERENCES [dbo].[Pedidos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Pedido_Detalles] ADD CONSTRAINT [FK_Detalle_Producto] FOREIGN KEY ([productoId]) REFERENCES [dbo].[Productos]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Reservas] ADD CONSTRAINT [Reservas_mesaId_fkey] FOREIGN KEY ([mesaId]) REFERENCES [dbo].[Mesas]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

