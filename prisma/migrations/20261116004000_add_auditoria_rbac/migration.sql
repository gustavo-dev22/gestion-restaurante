BEGIN TRY

BEGIN TRAN;

CREATE TABLE [dbo].[Auditoria] (
    [id] INT NOT NULL IDENTITY(1,1),
    [actorId] NVARCHAR(100),
    [actorNombre] NVARCHAR(150),
    [actorRol] NVARCHAR(100),
    [ip] NVARCHAR(64),
    [userAgent] NVARCHAR(500),
    [accion] NVARCHAR(100) NOT NULL,
    [entidad] NVARCHAR(50),
    [entidadId] NVARCHAR(100),
    [antes] NVARCHAR(MAX),
    [despues] NVARCHAR(MAX),
    [motivo] NVARCHAR(500),
    [requestId] NVARCHAR(100),
    [turnoId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Auditoria_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Auditoria_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [Auditoria_createdAt_idx]
    ON [dbo].[Auditoria]([createdAt]);
CREATE NONCLUSTERED INDEX [Auditoria_actorId_createdAt_idx]
    ON [dbo].[Auditoria]([actorId], [createdAt]);
CREATE NONCLUSTERED INDEX [Auditoria_accion_createdAt_idx]
    ON [dbo].[Auditoria]([accion], [createdAt]);
CREATE NONCLUSTERED INDEX [Auditoria_entidad_entidadId_idx]
    ON [dbo].[Auditoria]([entidad], [entidadId]);
CREATE NONCLUSTERED INDEX [Auditoria_turnoId_idx]
    ON [dbo].[Auditoria]([turnoId]);

-- La auditoría es append-only: los usuarios de la aplicación no deben editarla ni borrarla.
DENY UPDATE, DELETE ON [dbo].[Auditoria] TO [public];

CREATE TABLE [dbo].[UsuariosApp] (
    [id] INT NOT NULL IDENTITY(1,1),
    [sasiSub] NVARCHAR(100) NOT NULL,
    [nombre] NVARCHAR(150) NOT NULL,
    [email] NVARCHAR(200),
    [rolSasi] NVARCHAR(100),
    [activo] BIT NOT NULL CONSTRAINT [UsuariosApp_activo_df] DEFAULT 1,
    [ultimoAccesoEn] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [UsuariosApp_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [UsuariosApp_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UsuariosApp_sasiSub_key] UNIQUE NONCLUSTERED ([sasiSub])
);

CREATE NONCLUSTERED INDEX [UsuariosApp_activo_idx]
    ON [dbo].[UsuariosApp]([activo]);

CREATE TABLE [dbo].[RolesLocal] (
    [id] INT NOT NULL IDENTITY(1,1),
    [codigo] NVARCHAR(50) NOT NULL,
    [nombre] NVARCHAR(100) NOT NULL,
    [descripcion] NVARCHAR(300),
    [esSistema] BIT NOT NULL CONSTRAINT [RolesLocal_esSistema_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RolesLocal_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [RolesLocal_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RolesLocal_codigo_key] UNIQUE NONCLUSTERED ([codigo])
);

CREATE TABLE [dbo].[Permisos] (
    [id] INT NOT NULL IDENTITY(1,1),
    [codigo] NVARCHAR(100) NOT NULL,
    [nombre] NVARCHAR(150) NOT NULL,
    [descripcion] NVARCHAR(300),
    [grupo] NVARCHAR(50) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Permisos_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Permisos_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Permisos_codigo_key] UNIQUE NONCLUSTERED ([codigo])
);

CREATE NONCLUSTERED INDEX [Permisos_grupo_idx]
    ON [dbo].[Permisos]([grupo]);

CREATE TABLE [dbo].[RolPermisos] (
    [rolId] INT NOT NULL,
    [permisoId] INT NOT NULL,
    CONSTRAINT [RolPermisos_pkey] PRIMARY KEY CLUSTERED ([rolId], [permisoId])
);

CREATE NONCLUSTERED INDEX [RolPermisos_permisoId_idx]
    ON [dbo].[RolPermisos]([permisoId]);

CREATE TABLE [dbo].[UsuarioRoles] (
    [usuarioId] INT NOT NULL,
    [rolId] INT NOT NULL,
    CONSTRAINT [UsuarioRoles_pkey] PRIMARY KEY CLUSTERED ([usuarioId], [rolId])
);

CREATE NONCLUSTERED INDEX [UsuarioRoles_rolId_idx]
    ON [dbo].[UsuarioRoles]([rolId]);

CREATE TABLE [dbo].[UsuarioPermisos] (
    [usuarioId] INT NOT NULL,
    [permisoId] INT NOT NULL,
    [permitido] BIT NOT NULL CONSTRAINT [UsuarioPermisos_permitido_df] DEFAULT 1,
    CONSTRAINT [UsuarioPermisos_pkey] PRIMARY KEY CLUSTERED ([usuarioId], [permisoId])
);

CREATE NONCLUSTERED INDEX [UsuarioPermisos_permisoId_idx]
    ON [dbo].[UsuarioPermisos]([permisoId]);

ALTER TABLE [dbo].[RolPermisos] ADD CONSTRAINT [RolPermisos_rolId_fkey]
    FOREIGN KEY ([rolId]) REFERENCES [dbo].[RolesLocal]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[RolPermisos] ADD CONSTRAINT [RolPermisos_permisoId_fkey]
    FOREIGN KEY ([permisoId]) REFERENCES [dbo].[Permisos]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[UsuarioRoles] ADD CONSTRAINT [UsuarioRoles_usuarioId_fkey]
    FOREIGN KEY ([usuarioId]) REFERENCES [dbo].[UsuariosApp]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[UsuarioRoles] ADD CONSTRAINT [UsuarioRoles_rolId_fkey]
    FOREIGN KEY ([rolId]) REFERENCES [dbo].[RolesLocal]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[UsuarioPermisos] ADD CONSTRAINT [UsuarioPermisos_usuarioId_fkey]
    FOREIGN KEY ([usuarioId]) REFERENCES [dbo].[UsuariosApp]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[UsuarioPermisos] ADD CONSTRAINT [UsuarioPermisos_permisoId_fkey]
    FOREIGN KEY ([permisoId]) REFERENCES [dbo].[Permisos]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
