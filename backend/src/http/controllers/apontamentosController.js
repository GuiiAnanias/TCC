/**
 * [CONTROLLER] Apontamentos de horas: recebe /api/apontamentos, valida com
 * schemas/apontamentosSchemas.js e chama o apontamentosService (regras de 24 h, equipe e
 * faturamento).
 */

import { apontamentosService } from "../../services/apontamentosService.js";
import { tratarAssincrono } from "../../utils/tratarAssincrono.js";
import { lerId } from "../../utils/lerId.js";
import {
  apontamentoCreateSchema,
  apontamentoUpdateSchema,
  apontamentoQuerySchema,
} from "../../schemas/apontamentosSchemas.js";
export const apontamentosController = {
  // [CONTROLLER] Lista os registros. Os filtros da URL (?busca=&status=) passam pelo schema Zod de
  // consulta.
  list: tratarAssincrono(async (req, res) => {
    const filters = apontamentoQuerySchema.parse(req.query);
    const apontamentos = await apontamentosService.list(filters);
    res.json(apontamentos);
  }),
  // [CONTROLLER] Busca um registro pelo id da URL. [VALIDACAO] lerId recusa id que não seja
  // inteiro positivo (400).
  getById: tratarAssincrono(async (req, res) => {
    const id = lerId(req.params.id);
    const apontamento = await apontamentosService.getById(id);
    res.json(apontamento);
  }),
  // [CONTROLLER] Lança horas. [VALIDACAO] Schema de criação; as regras (data, 24 h no dia, equipe)
  // ficam no service.
  create: tratarAssincrono(async (req, res) => {
    const data = apontamentoCreateSchema.parse(req.body);
    const apontamento = await apontamentosService.create(data);
    res.status(201).json(apontamento);
  }),
  // [CONTROLLER] Edita. [VALIDACAO] Valida o id e o corpo (schema de edição, campos parciais) e
  // chama o service.
  update: tratarAssincrono(async (req, res) => {
    const id = lerId(req.params.id);
    const data = apontamentoUpdateSchema.parse(req.body);
    const apontamento = await apontamentosService.update(id, data);
    res.json(apontamento);
  }),
  // [CONTROLLER] Exclui de verdade; apontamento faturado é recusado no service.
  remove: tratarAssincrono(async (req, res) => {
    const id = lerId(req.params.id);
    await apontamentosService.remove(id);
    res.status(204).send();
  }),
};
