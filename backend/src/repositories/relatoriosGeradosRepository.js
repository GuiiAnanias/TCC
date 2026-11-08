import prisma from "../config/prisma.js";

const include = { criadoPor: { select: { id: true, nomeUsuario: true } } };

export const relatoriosGeradosRepository = {
  findClients(ids) {
    return prisma.cliente.findMany({
      where: { id: { in: ids } },
      select: { id: true, projetos: { select: { id: true }, take: 51 } },
    });
  },
  countProjects(ids) {
    return prisma.projeto.count({ where: { id: { in: ids } } });
  },
  // Os projetos de `conteudo.projetos` são registrados pelo banco (relatorios_projetos).
  create(data) {
    return prisma.relatorioGerado.create({ data, include });
  },
  findById(id) {
    return prisma.relatorioGerado.findUnique({ where: { id }, include });
  },
};
