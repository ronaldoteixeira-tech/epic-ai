import fs from "node:fs";
import path from "node:path";

const directory = path.resolve(import.meta.dirname, "..", "n8n");
const files = fs.readdirSync(directory).filter((name) => name.endsWith(".workflow.json"));

for (const file of files) {
  const workflow = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
  if (!workflow.name || !Array.isArray(workflow.nodes) || !workflow.nodes.length) {
    throw new Error(`${file}: estrutura de workflow inválida`);
  }

  const names = new Set(workflow.nodes.map((node) => node.name));
  if (names.size !== workflow.nodes.length) throw new Error(`${file}: nomes de nodes duplicados`);

  for (const node of workflow.nodes) {
    if (node.type === "n8n-nodes-base.code") {
      new Function(node.parameters.jsCode);
    }
  }

  for (const [source, outputs] of Object.entries(workflow.connections || {})) {
    if (!names.has(source)) throw new Error(`${file}: origem inexistente ${source}`);
    for (const group of outputs.main || []) {
      for (const connection of group || []) {
        if (!names.has(connection.node)) {
          throw new Error(`${file}: destino inexistente ${connection.node}`);
        }
      }
    }
  }

  console.log(`${file}: ${workflow.nodes.length} nodes validados`);
}
