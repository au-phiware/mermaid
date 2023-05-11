import { DiagramDefinition } from '../../diagram-api/types.js';
// @ts-ignore: TODO Fix ts errors
import parser from './parser/communicationDiagram.jison';
import db from './communicationDb.js';
import styles from './styles.js';
import renderer from './communicationRenderer.js';

export const diagram: DiagramDefinition = {
  parser,
  db,
  renderer,
  styles,
};
