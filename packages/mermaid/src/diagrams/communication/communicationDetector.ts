import type { DiagramDetector, ExternalDiagramDefinition } from '../../diagram-api/types.js';

const id = 'communication';

const detector: DiagramDetector = (txt) => {
  return txt.match(/^\s*communicationDiagram/) !== null;
};

const loader = async () => {
  const { diagram } = await import('./communicationDiagram.js');
  return { id, diagram };
};

const plugin: ExternalDiagramDefinition = {
  id,
  detector,
  loader,
};

export default plugin;
