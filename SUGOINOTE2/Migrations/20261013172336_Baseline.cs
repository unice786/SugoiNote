using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SUGOINOTE2.Migrations
{
    /// <summary>
    /// Línea base del esquema.
    ///
    /// La base de datos de Azure SQL YA contiene las tablas Apuntes, Estudiantes, Materias,
    /// Preguntas, Examenes, OpcionesRespuesta, ForoComunidad, RespuestasForo, EncuestaOpciones y
    /// EncuestaVotos, creadas originalmente por DDL manual (Data/EstudianteDbSetup.cs y
    /// Data/ComunidadDbSetup.cs, ya eliminados).
    ///
    /// Por eso el Up() NO vuelve a crear esas tablas: solo añade lo que faltaba.
    /// Ejecutar esto contra una base de datos VACÍA sí crea el esquema completo.
    /// </summary>
    public partial class Baseline : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Seguridad: columnas nuevas en Estudiantes ──────────
            migrationBuilder.AddColumn<int>(
                name: "FailedLoginCount",
                table: "Estudiantes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "LockoutEndUtc",
                table: "Estudiantes",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SecurityStamp",
                table: "Estudiantes",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            // ── Recuperación de contraseña con token de un uso ────
            migrationBuilder.CreateTable(
                name: "PasswordResetTokens",
                columns: table => new
                {
                    TokenID = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EstudianteID = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CreadoUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiraUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsadoUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResetTokens", x => x.TokenID);
                    table.ForeignKey(
                        name: "FK_PasswordResetTokens_Estudiantes_EstudianteID",
                        column: x => x.EstudianteID,
                        principalTable: "Estudiantes",
                        principalColumn: "EstudianteID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_TokenHash",
                table: "PasswordResetTokens",
                column: "TokenHash");

            // ── Claves de DataProtection persistidas ──────────────
            // Sin esta tabla, ASP.NET Core regenera las claves en cada reinicio y
            // todos los usuarios pierden la sesión.
            migrationBuilder.CreateTable(
                name: "DataProtectionKeys",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FriendlyName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Xml = table.Column<string>(type: "nvarchar(max)", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DataProtectionKeys", x => x.Id);
                });

            // ── Índices que faltaban sobre datos existentes ───────
            // Las consultas del perfil filtraban por EstudianteID y por
            // FechaRegistro; sin índice cada visita a /Perfil hacía un escaneo completo.
            migrationBuilder.CreateIndex(
                name: "IX_Apuntes_EstudianteID",
                table: "Apuntes",
                column: "EstudianteID");

            migrationBuilder.CreateIndex(
                name: "IX_ForoComunidad_FechaPublicacion",
                table: "ForoComunidad",
                column: "FechaPublicacion");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "DataProtectionKeys");

            migrationBuilder.DropIndex(name: "IX_ForoComunidad_FechaPublicacion", table: "ForoComunidad");
            migrationBuilder.DropIndex(name: "IX_Apuntes_EstudianteID", table: "Apuntes");

            migrationBuilder.DropTable(name: "PasswordResetTokens");

            migrationBuilder.DropColumn(name: "SecurityStamp", table: "Estudiantes");
            migrationBuilder.DropColumn(name: "LockoutEndUtc", table: "Estudiantes");
            migrationBuilder.DropColumn(name: "FailedLoginCount", table: "Estudiantes");
        }
    }
}