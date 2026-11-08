BEGIN TRY

BEGIN TRAN;

CREATE TABLE [dbo].[Idempotency_Keys] (
    [id] NVARCHAR(64) NOT NULL,
    [key] NVARCHAR(100) NOT NULL,
    [status] INT NOT NULL CONSTRAINT [DF_Idempotency_Keys_status] DEFAULT 0,
    [response] NVARCHAR(MAX),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DF_Idempotency_Keys_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [expiresAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_Idempotency_Keys] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [Idempotency_Keys_key_key] ON [dbo].[Idempotency_Keys]([key]);
CREATE INDEX [Idempotency_Keys_expiresAt_idx] ON [dbo].[Idempotency_Keys]([expiresAt]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;

THROW

END CATCH
