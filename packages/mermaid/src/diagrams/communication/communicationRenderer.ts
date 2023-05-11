// @ts-nocheck TODO: fix file
import { select, selectAll } from 'd3';
import * as graphlib from 'dagre-d3-es/src/graphlib/index.js';
import svgDraw, { drawText } from './svgDraw.js';
import { log } from '../../logger.js';
import common from '../common/common.js';
import * as svgDrawCommon from '../common/svgDrawCommon';
import * as configApi from '../../config.js';
import assignWithDepth from '../../assignWithDepth.js';
import utils from '../../utils.js';
import { configureSvgSize } from '../../setupGraphViewbox.js';
import { Diagram } from '../../Diagram.js';

let conf = {};

export const bounds = {
  data: {
    startx: undefined,
    stopx: undefined,
    starty: undefined,
    stopy: undefined,
  },
  verticalPos: 0,
  sequenceItems: [],
  models: {
    getHeight: function () {
      return (
        Math.max.apply(
          null,
          this.actors.length === 0 ? [0] : this.actors.map((actor) => actor.height || 0)
        ) +
        (this.loops.length === 0
          ? 0
          : this.loops.map((it) => it.height || 0).reduce((acc, h) => acc + h)) +
        (this.messages.length === 0
          ? 0
          : this.messages.map((it) => it.height || 0).reduce((acc, h) => acc + h)) +
        (this.notes.length === 0
          ? 0
          : this.notes.map((it) => it.height || 0).reduce((acc, h) => acc + h))
      );
    },
    clear: function () {
      this.actors = [];
      this.boxes = [];
      this.loops = [];
      this.messages = [];
      this.notes = [];
    },
    addBox: function (boxModel) {
      this.boxes.push(boxModel);
    },
    addActor: function (actorModel) {
      this.actors.push(actorModel);
    },
    addLoop: function (loopModel) {
      this.loops.push(loopModel);
    },
    addMessage: function (msgModel) {
      this.messages.push(msgModel);
    },
    addNote: function (noteModel) {
      this.notes.push(noteModel);
    },
    lastActor: function () {
      return this.actors[this.actors.length - 1];
    },
    lastLoop: function () {
      return this.loops[this.loops.length - 1];
    },
    lastMessage: function () {
      return this.messages[this.messages.length - 1];
    },
    lastNote: function () {
      return this.notes[this.notes.length - 1];
    },
    actors: [],
    boxes: [],
    loops: [],
    messages: [],
    notes: [],
  },
  init: function () {
    this.sequenceItems = [];
    this.models.clear();
    this.data = {
      startx: undefined,
      stopx: undefined,
      starty: undefined,
      stopy: undefined,
    };
    this.verticalPos = 0;
    setConf(configApi.getConfig());
  },
  updateVal: function (obj, key, val, fun) {
    if (obj[key] === undefined) {
      obj[key] = val;
    } else {
      obj[key] = fun(val, obj[key]);
    }
  },
  updateBounds: function (startx, starty, stopx, stopy) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _self = this;
    let cnt = 0;
    function updateFn() {
      return function updateItemBounds(item) {
        cnt++;
        // The loop sequenceItems is a stack so the biggest margins in the beginning of the sequenceItems
        const n = _self.sequenceItems.length - cnt + 1;

        _self.updateVal(item, 'starty', starty - n * conf.boxMargin, Math.min);
        _self.updateVal(item, 'stopy', stopy + n * conf.boxMargin, Math.max);

        _self.updateVal(bounds.data, 'startx', startx - n * conf.boxMargin, Math.min);
        _self.updateVal(bounds.data, 'stopx', stopx + n * conf.boxMargin, Math.max);

        _self.updateVal(item, 'startx', startx - n * conf.boxMargin, Math.min);
        _self.updateVal(item, 'stopx', stopx + n * conf.boxMargin, Math.max);

        _self.updateVal(bounds.data, 'starty', starty - n * conf.boxMargin, Math.min);
        _self.updateVal(bounds.data, 'stopy', stopy + n * conf.boxMargin, Math.max);
      };
    }

    this.sequenceItems.forEach(updateFn());
  },
  insert: function (startx, starty, stopx, stopy) {
    const _startx = common.getMin(startx, stopx);
    const _stopx = common.getMax(startx, stopx);
    const _starty = common.getMin(starty, stopy);
    const _stopy = common.getMax(starty, stopy);

    this.updateVal(bounds.data, 'startx', _startx, Math.min);
    this.updateVal(bounds.data, 'starty', _starty, Math.min);
    this.updateVal(bounds.data, 'stopx', _stopx, Math.max);
    this.updateVal(bounds.data, 'stopy', _stopy, Math.max);

    this.updateBounds(_startx, _starty, _stopx, _stopy);
  },
  bumpVerticalPos: function (bump) {
    this.verticalPos = this.verticalPos + bump;
    this.data.stopy = common.getMax(this.data.stopy, this.verticalPos);
  },
  getVerticalPos: function () {
    return this.verticalPos;
  },
  getBounds: function () {
    return { bounds: this.data, models: this.models };
  },
};

/** Options for drawing a note in {@link drawNote} */
interface NoteModel {
  /** x axis start position */
  startx: number;
  /** y axis position */
  starty: number;
  /** the message to be shown */
  message: string;
  /** Set this with a custom width to override the default configured width. */
  width: number;
}

/**
 * Draws an note in the diagram with the attached line
 *
 * @param elem - The diagram to draw to.
 * @param noteModel - Note model options.
 */
const drawNote = function (elem: any, noteModel: NoteModel) {
  bounds.bumpVerticalPos(conf.boxMargin);
  noteModel.height = conf.boxMargin;
  noteModel.starty = bounds.getVerticalPos();
  const rect = svgDrawCommon.getNoteRect();
  rect.x = noteModel.startx;
  rect.y = noteModel.starty;
  rect.width = noteModel.width || conf.width;
  rect.class = 'note';

  const g = elem.append('g');
  const rectElem = svgDraw.drawRect(g, rect);
  const textObj = svgDrawCommon.getTextObj();
  textObj.x = noteModel.startx;
  textObj.y = noteModel.starty;
  textObj.width = rect.width;
  textObj.dy = '1em';
  textObj.text = noteModel.message;
  textObj.class = 'noteText';
  textObj.fontFamily = conf.noteFontFamily;
  textObj.fontSize = conf.noteFontSize;
  textObj.fontWeight = conf.noteFontWeight;
  textObj.anchor = conf.noteAlign;
  textObj.textMargin = conf.noteMargin;
  textObj.valign = 'center';

  const textElem = drawText(g, textObj);

  const textHeight = Math.round(
    textElem
      .map((te) => (te._groups || te)[0][0].getBBox().height)
      .reduce((acc, curr) => acc + curr)
  );

  rectElem.attr('height', textHeight + 2 * conf.noteMargin);
  noteModel.height += textHeight + 2 * conf.noteMargin;
  bounds.bumpVerticalPos(textHeight + 2 * conf.noteMargin);
  noteModel.stopy = noteModel.starty + textHeight + 2 * conf.noteMargin;
  noteModel.stopx = noteModel.startx + rect.width;
  bounds.insert(noteModel.startx, noteModel.starty, noteModel.stopx, noteModel.stopy);
  bounds.models.addNote(noteModel);
};

const messageFont = (cnf) => {
  return {
    fontFamily: cnf.messageFontFamily,
    fontSize: cnf.messageFontSize,
    fontWeight: cnf.messageFontWeight,
  };
};
const noteFont = (cnf) => {
  return {
    fontFamily: cnf.noteFontFamily,
    fontSize: cnf.noteFontSize,
    fontWeight: cnf.noteFontWeight,
  };
};
const actorFont = (cnf) => {
  return {
    fontFamily: cnf.actorFontFamily,
    fontSize: cnf.actorFontSize,
    fontWeight: cnf.actorFontWeight,
  };
};

/**
 * Process a message by adding its dimensions to the bound. It returns the Y coordinate of the
 * message so it can be drawn later.
 *
 * @param _diagram - The parent of the message element.
 * @param msgModel - The model containing fields describing a message
 * @returns `lineStartY` - The Y coordinate at which the message line starts
 */
function boundMessage(_diagram, msgModel): number {
  bounds.bumpVerticalPos(10);
  const { startx, stopx, message } = msgModel;
  const lines = common.splitBreaks(message).length;
  const textDims = utils.calculateTextDimensions(message, messageFont(conf));
  const lineHeight = textDims.height / lines;
  msgModel.height += lineHeight;

  bounds.bumpVerticalPos(lineHeight);

  let lineStartY;
  let totalOffset = textDims.height - 10;
  const textWidth = textDims.width;

  if (startx === stopx) {
    lineStartY = bounds.getVerticalPos() + totalOffset;
    if (!conf.rightAngles) {
      totalOffset += conf.boxMargin;
      lineStartY = bounds.getVerticalPos() + totalOffset;
    }
    totalOffset += 30;
    const dx = common.getMax(textWidth / 2, conf.width / 2);
    bounds.insert(
      startx - dx,
      bounds.getVerticalPos() - 10 + totalOffset,
      stopx + dx,
      bounds.getVerticalPos() + 30 + totalOffset
    );
  } else {
    totalOffset += conf.boxMargin;
    lineStartY = bounds.getVerticalPos() + totalOffset;
    bounds.insert(startx, lineStartY - 10, stopx, lineStartY);
  }
  bounds.bumpVerticalPos(totalOffset);
  msgModel.height += totalOffset;
  msgModel.stopy = msgModel.starty + msgModel.height;
  bounds.insert(msgModel.fromBounds, msgModel.starty, msgModel.toBounds, msgModel.stopy);

  return lineStartY;
}

/**
 * Draws a message. Note that the bounds have previously been updated by boundMessage.
 *
 * @param diagram - The parent of the message element
 * @param msgModel - The model containing fields describing a message
 * @param lineStartY - The Y coordinate at which the message line starts
 * @param diagObj - The diagram object.
 */
const drawMessage = function (diagram, msgModel, lineStartY: number, diagObj: Diagram) {
  const { startx, stopx, starty, message, type } = msgModel;
  const textDims = utils.calculateTextDimensions(message, messageFont(conf));
  const textObj = svgDrawCommon.getTextObj();
  textObj.x = startx;
  textObj.y = starty + 10;
  textObj.width = stopx - startx;
  textObj.class = 'messageText';
  textObj.dy = '1em';
  textObj.text = message;
  textObj.fontFamily = conf.messageFontFamily;
  textObj.fontSize = conf.messageFontSize;
  textObj.fontWeight = conf.messageFontWeight;
  textObj.anchor = conf.messageAlign;
  textObj.valign = 'center';
  textObj.textMargin = conf.wrapPadding;
  textObj.tspan = false;

  drawText(diagram, textObj);

  const textWidth = textDims.width;

  let line;
  if (startx === stopx) {
    if (conf.rightAngles) {
      line = diagram
        .append('path')
        .attr(
          'd',
          `M  ${startx},${lineStartY} H ${
            startx + common.getMax(conf.width / 2, textWidth / 2)
          } V ${lineStartY + 25} H ${startx}`
        );
    } else {
      line = diagram
        .append('path')
        .attr(
          'd',
          'M ' +
            startx +
            ',' +
            lineStartY +
            ' C ' +
            (startx + 60) +
            ',' +
            (lineStartY - 10) +
            ' ' +
            (startx + 60) +
            ',' +
            (lineStartY + 30) +
            ' ' +
            startx +
            ',' +
            (lineStartY + 20)
        );
    }
  } else {
    line = diagram.append('line');
    line.attr('x1', startx);
    line.attr('y1', lineStartY);
    line.attr('x2', stopx);
    line.attr('y2', lineStartY);
  }
  // Make an SVG Container
  // Draw the line
  if (
    type === diagObj.db.LINETYPE.DOTTED ||
    type === diagObj.db.LINETYPE.DOTTED_CROSS ||
    type === diagObj.db.LINETYPE.DOTTED_POINT ||
    type === diagObj.db.LINETYPE.DOTTED_OPEN
  ) {
    line.style('stroke-dasharray', '3, 3');
    line.attr('class', 'messageLine1');
  } else {
    line.attr('class', 'messageLine0');
  }

  let url = '';
  if (conf.arrowMarkerAbsolute) {
    url =
      window.location.protocol +
      '//' +
      window.location.host +
      window.location.pathname +
      window.location.search;
    url = url.replace(/\(/g, '\\(');
    url = url.replace(/\)/g, '\\)');
  }

  line.attr('stroke-width', 2);
  line.attr('stroke', 'none'); // handled by theme/css anyway
  line.style('fill', 'none'); // remove any fill colour
  if (type === diagObj.db.LINETYPE.SOLID || type === diagObj.db.LINETYPE.DOTTED) {
    line.attr('marker-end', 'url(' + url + '#arrowhead)');
  }
  if (type === diagObj.db.LINETYPE.SOLID_POINT || type === diagObj.db.LINETYPE.DOTTED_POINT) {
    line.attr('marker-end', 'url(' + url + '#filled-head)');
  }

  if (type === diagObj.db.LINETYPE.SOLID_CROSS || type === diagObj.db.LINETYPE.DOTTED_CROSS) {
    line.attr('marker-end', 'url(' + url + '#crosshead)');
  }
};

export const drawActors = function (
  diagram,
  actors,
  actorKeys,
  verticalPos,
  configuration,
  messages,
  isFooter
) {
  if (configuration.hideUnusedParticipants === true) {
    const newActors = new Set();
    messages.forEach((message) => {
      newActors.add(message.from);
      newActors.add(message.to);
    });
    actorKeys = actorKeys.filter((actorKey) => newActors.has(actorKey));
  }

  // Draw the actors
  let prevWidth = 0;
  let prevMargin = 0;
  let maxHeight = 0;
  let prevBox = undefined;

  for (const actorKey of actorKeys) {
    const actor = actors[actorKey];
    const box = actor.box;

    // end of box
    if (prevBox && prevBox != box) {
      if (!isFooter) {
        bounds.models.addBox(prevBox);
      }
      prevMargin += conf.boxMargin + prevBox.margin;
    }

    // new box
    if (box && box != prevBox) {
      if (!isFooter) {
        box.x = prevWidth + prevMargin;
        box.y = verticalPos;
      }
      prevMargin += box.margin;
    }

    // Add some rendering data to the object
    actor.width = actor.width || conf.width;
    actor.height = common.getMax(actor.height || conf.height, conf.height);
    actor.margin = actor.margin || conf.actorMargin;

    actor.x = prevWidth + prevMargin;
    actor.y = bounds.getVerticalPos();

    // Draw the box with the attached line
    const height = svgDraw.drawActor(diagram, actor, conf, isFooter);
    maxHeight = common.getMax(maxHeight, height);
    bounds.insert(actor.x, verticalPos, actor.x + actor.width, actor.height);

    prevWidth += actor.width + prevMargin;
    if (actor.box) {
      actor.box.width = prevWidth + box.margin - actor.box.x;
    }
    prevMargin = actor.margin;
    prevBox = actor.box;
    bounds.models.addActor(actor);
  }

  // end of box
  if (prevBox && !isFooter) {
    bounds.models.addBox(prevBox);
  }

  // Add a margin between the actor boxes and the first arrow
  bounds.bumpVerticalPos(maxHeight);
};

export const drawActorsPopup = function (diagram, actors, actorKeys, doc) {
  let maxHeight = 0;
  let maxWidth = 0;
  for (const actorKey of actorKeys) {
    const actor = actors[actorKey];
    const minMenuWidth = getRequiredPopupWidth(actor);
    const menuDimensions = svgDraw.drawPopup(
      diagram,
      actor,
      minMenuWidth,
      conf,
      conf.forceMenus,
      doc
    );
    if (menuDimensions.height > maxHeight) {
      maxHeight = menuDimensions.height;
    }
    if (menuDimensions.width + actor.x > maxWidth) {
      maxWidth = menuDimensions.width + actor.x;
    }
  }

  return { maxHeight: maxHeight, maxWidth: maxWidth };
};

export const setConf = function (cnf) {
  assignWithDepth(conf, cnf);

  if (cnf.fontFamily) {
    conf.actorFontFamily = conf.noteFontFamily = conf.messageFontFamily = cnf.fontFamily;
  }
  if (cnf.fontSize) {
    conf.actorFontSize = conf.noteFontSize = conf.messageFontSize = cnf.fontSize;
  }
  if (cnf.fontWeight) {
    conf.actorFontWeight = conf.noteFontWeight = conf.messageFontWeight = cnf.fontWeight;
  }
};

/**
 * Draws a communicationDiagram in the tag with id: id based on the graph definition in text.
 *
 * @param text - The text of the diagram
 * @param id - The id of the diagram which will be used as a DOM element id¨
 * @param _version - Mermaid version from package.json
 * @param diagObj - A standard diagram containing the db and the text and type etc of the diagram
 */
export const draw = function (text: string, id: string, _version: string, diagObj: Diagram) {
  const { securityLevel, communication } = configApi.getConfig();
  conf = communication;
  diagObj.db.clear();
  // Parse the graph definition
  diagObj.parser.parse(text);
  // Handle root and Document for when rendering in sandbox mode
  let sandboxElement;
  if (securityLevel === 'sandbox') {
    sandboxElement = select('#i' + id);
  }
  const nodeSpacing = conf?.nodeSpacing ?? 50;
  const rankSpacing = conf?.rankSpacing ?? 50;

  // Create the input mermaid.graph
  const g: graphlib.Graph = new graphlib.Graph({
    multigraph: true,
    compound: true,
  })
    .setGraph({
      rankdir: diagObj.db.getDirection(),
      nodesep: nodeSpacing,
      ranksep: rankSpacing,
      marginx: 8,
      marginy: 8,
    })
    .setDefaultEdgeLabel(function () {
      return {};
    });

  const root =
    securityLevel === 'sandbox'
      ? select(sandboxElement.nodes()[0].contentDocument.body)
      : select('body');
  const doc = securityLevel === 'sandbox' ? sandboxElement.nodes()[0].contentDocument : document;
  bounds.init();
  log.debug(diagObj.db);

  const diagram =
    securityLevel === 'sandbox' ? root.select(`[id="${id}"]`) : select(`[id="${id}"]`);

  // Fetch data from the parsing
  const actors = diagObj.db.getActors();
  const boxes = diagObj.db.getBoxes();
  const actorKeys = diagObj.db.getActorKeys();
  const messages = diagObj.db.getMessages();
  const title = diagObj.db.getDiagramTitle();
  const hasBoxes = diagObj.db.hasAtLeastOneBox();
  const hasBoxTitles = diagObj.db.hasAtLeastOneBoxWithTitle();
  const maxMessageWidthPerActor = getMaxMessageWidthPerActor(actors, messages, diagObj);
  conf.height = calculateActorMargins(actors, maxMessageWidthPerActor, boxes);

  svgDraw.insertComputerIcon(diagram);
  svgDraw.insertDatabaseIcon(diagram);
  svgDraw.insertClockIcon(diagram);

  if (hasBoxes) {
    bounds.bumpVerticalPos(conf.boxMargin);
    if (hasBoxTitles) {
      bounds.bumpVerticalPos(boxes[0].textMaxHeight);
    }
  }

  drawActors(diagram, actors, actorKeys, 0, conf, messages, false);

  // The arrow head definition is attached to the svg once
  svgDraw.insertArrowHead(diagram);
  svgDraw.insertArrowCrossHead(diagram);
  svgDraw.insertArrowFilledHead(diagram);

  // Draw the messages/signals
  const messagesToDraw = [];
  messages.forEach(function (msg) {
    let noteModel, msgModel;

    switch (msg.type) {
      case diagObj.db.LINETYPE.NOTE:
        noteModel = msg.noteModel;
        drawNote(diagram, noteModel);
        break;
      default:
        try {
          // lastMsg = msg
          msgModel = msg.msgModel;
          msgModel.starty = bounds.getVerticalPos();
          const lineStartY = boundMessage(diagram, msgModel);
          messagesToDraw.push({ messageModel: msgModel, lineStartY: lineStartY });
          bounds.models.addMessage(msgModel);
        } catch (e) {
          log.error('error while drawing message', e);
        }
    }
  });

  messagesToDraw.forEach((e) => drawMessage(diagram, e.messageModel, e.lineStartY, diagObj));

  bounds.models.boxes.forEach(function (box) {
    box.height = bounds.getVerticalPos() - box.y;
    bounds.insert(box.x, box.y, box.x + box.width, box.height);
    box.startx = box.x;
    box.starty = box.y;
    box.stopx = box.startx + box.width;
    box.stopy = box.starty + box.height;
    box.stroke = 'rgb(0,0,0, 0.5)';
    svgDraw.drawBox(diagram, box, conf);
  });

  if (hasBoxes) {
    bounds.bumpVerticalPos(conf.boxMargin);
  }

  // only draw popups for the top row of actors.
  const requiredBoxSize = drawActorsPopup(diagram, actors, actorKeys, doc);

  const { bounds: box } = bounds.getBounds();

  // Adjust line height of actor lines now that the height of the diagram is known
  log.debug('For line height fix Querying: #' + id + ' .actor-line');
  const actorLines = selectAll('#' + id + ' .actor-line');
  actorLines.attr('y2', box.stopy);

  // Make sure the height of the diagram supports long menus.
  let boxHeight = box.stopy - box.starty;
  if (boxHeight < requiredBoxSize.maxHeight) {
    boxHeight = requiredBoxSize.maxHeight;
  }

  let height = boxHeight + 2 * conf.diagramMarginY;
  if (conf.mirrorActors) {
    height = height - conf.boxMargin + conf.bottomMarginAdj;
  }

  // Make sure the width of the diagram supports wide menus.
  let boxWidth = box.stopx - box.startx;
  if (boxWidth < requiredBoxSize.maxWidth) {
    boxWidth = requiredBoxSize.maxWidth;
  }
  const width = boxWidth + 2 * conf.diagramMarginX;

  if (title) {
    diagram
      .append('text')
      .text(title)
      .attr('x', (box.stopx - box.startx) / 2 - 2 * conf.diagramMarginX)
      .attr('y', -25);
  }

  configureSvgSize(diagram, height, width, conf.useMaxWidth);

  const extraVertForTitle = title ? 40 : 0;
  diagram.attr(
    'viewBox',
    box.startx -
      conf.diagramMarginX +
      ' -' +
      (conf.diagramMarginY + extraVertForTitle) +
      ' ' +
      width +
      ' ' +
      (height + extraVertForTitle)
  );

  log.debug(`models:`, bounds.models);
};

/**
 * Retrieves the max message width of each actor, supports signals (messages, loops) and notes.
 *
 * It will enumerate each given message, and will determine its text width, in relation to the actor
 * it originates from, and destined to.
 *
 * @param actors - The actors map
 * @param messages - A list of message objects to iterate
 * @param diagObj - The diagram object.
 * @returns The max message width of each actor.
 */
function getMaxMessageWidthPerActor(
  actors: { [id: string]: any },
  messages: any[],
  diagObj: Diagram
): { [id: string]: number } {
  const maxMessageWidthPerActor = {};

  messages.forEach(function (msg) {
    if (actors[msg.to] && actors[msg.from]) {
      const actor = actors[msg.to];

      // If this is the first actor, and the message is left of it, no need to calculate the margin
      if (msg.placement === diagObj.db.PLACEMENT.LEFTOF && !actor.prevActor) {
        return;
      }

      // If this is the last actor, and the message is right of it, no need to calculate the margin
      if (msg.placement === diagObj.db.PLACEMENT.RIGHTOF && !actor.nextActor) {
        return;
      }

      const isNote = msg.placement !== undefined;
      const isMessage = !isNote;

      const textFont = isNote ? noteFont(conf) : messageFont(conf);
      const wrappedMessage = msg.wrap
        ? utils.wrapLabel(msg.message, conf.width - 2 * conf.wrapPadding, textFont)
        : msg.message;
      const messageDimensions = utils.calculateTextDimensions(wrappedMessage, textFont);
      const messageWidth = messageDimensions.width + 2 * conf.wrapPadding;

      /*
       * The following scenarios should be supported:
       *
       * - There's a message (non-note) between fromActor and toActor
       *   - If fromActor is on the right and toActor is on the left, we should
       *     define the toActor's margin
       *   - If fromActor is on the left and toActor is on the right, we should
       *     define the fromActor's margin
       * - There's a note, in which case fromActor == toActor
       *   - If the note is to the left of the actor, we should define the previous actor
       *     margin
       *   - If the note is on the actor, we should define both the previous and next actor
       *     margins, each being the half of the note size
       *   - If the note is on the right of the actor, we should define the current actor
       *     margin
       */
      if (isMessage && msg.from === actor.nextActor) {
        maxMessageWidthPerActor[msg.to] = common.getMax(
          maxMessageWidthPerActor[msg.to] || 0,
          messageWidth
        );
      } else if (isMessage && msg.from === actor.prevActor) {
        maxMessageWidthPerActor[msg.from] = common.getMax(
          maxMessageWidthPerActor[msg.from] || 0,
          messageWidth
        );
      } else if (isMessage && msg.from === msg.to) {
        maxMessageWidthPerActor[msg.from] = common.getMax(
          maxMessageWidthPerActor[msg.from] || 0,
          messageWidth / 2
        );

        maxMessageWidthPerActor[msg.to] = common.getMax(
          maxMessageWidthPerActor[msg.to] || 0,
          messageWidth / 2
        );
      } else if (msg.placement === diagObj.db.PLACEMENT.RIGHTOF) {
        maxMessageWidthPerActor[msg.from] = common.getMax(
          maxMessageWidthPerActor[msg.from] || 0,
          messageWidth
        );
      } else if (msg.placement === diagObj.db.PLACEMENT.LEFTOF) {
        maxMessageWidthPerActor[actor.prevActor] = common.getMax(
          maxMessageWidthPerActor[actor.prevActor] || 0,
          messageWidth
        );
      } else if (msg.placement === diagObj.db.PLACEMENT.OVER) {
        if (actor.prevActor) {
          maxMessageWidthPerActor[actor.prevActor] = common.getMax(
            maxMessageWidthPerActor[actor.prevActor] || 0,
            messageWidth / 2
          );
        }

        if (actor.nextActor) {
          maxMessageWidthPerActor[msg.from] = common.getMax(
            maxMessageWidthPerActor[msg.from] || 0,
            messageWidth / 2
          );
        }
      }
    }
  });

  log.debug('maxMessageWidthPerActor:', maxMessageWidthPerActor);
  return maxMessageWidthPerActor;
}

const getRequiredPopupWidth = function (actor) {
  let requiredPopupWidth = 0;
  const textFont = actorFont(conf);
  for (const key in actor.links) {
    const labelDimensions = utils.calculateTextDimensions(key, textFont);
    const labelWidth = labelDimensions.width + 2 * conf.wrapPadding + 2 * conf.boxMargin;
    if (requiredPopupWidth < labelWidth) {
      requiredPopupWidth = labelWidth;
    }
  }

  return requiredPopupWidth;
};

/**
 * This will calculate the optimal margin for each given actor,
 * for a given actor → messageWidth map.
 *
 * An actor's margin is determined by the width of the actor, the width of the largest message that
 * originates from it, and the configured conf.actorMargin.
 *
 * @param actors - The actors map to calculate margins for
 * @param actorToMessageWidth - A map of actor key → max message width it holds
 * @param boxes - The boxes around the actors if any
 */
function calculateActorMargins(
  actors: { [id: string]: any },
  actorToMessageWidth: ReturnType<typeof getMaxMessageWidthPerActor>,
  boxes
) {
  let maxHeight = 0;
  Object.keys(actors).forEach((prop) => {
    const actor = actors[prop];
    if (actor.wrap) {
      actor.description = utils.wrapLabel(
        actor.description,
        conf.width - 2 * conf.wrapPadding,
        actorFont(conf)
      );
    }
    const actDims = utils.calculateTextDimensions(actor.description, actorFont(conf));
    actor.width = actor.wrap
      ? conf.width
      : common.getMax(conf.width, actDims.width + 2 * conf.wrapPadding);

    actor.height = actor.wrap ? common.getMax(actDims.height, conf.height) : conf.height;
    maxHeight = common.getMax(maxHeight, actor.height);
  });

  for (const actorKey in actorToMessageWidth) {
    const actor = actors[actorKey];

    if (!actor) {
      continue;
    }

    const nextActor = actors[actor.nextActor];

    // No need to space out an actor that doesn't have a next link
    if (!nextActor) {
      const messageWidth = actorToMessageWidth[actorKey];
      const actorWidth = messageWidth + conf.actorMargin - actor.width / 2;
      actor.margin = common.getMax(actorWidth, conf.actorMargin);
      continue;
    }

    const messageWidth = actorToMessageWidth[actorKey];
    const actorWidth = messageWidth + conf.actorMargin - actor.width / 2 - nextActor.width / 2;

    actor.margin = common.getMax(actorWidth, conf.actorMargin);
  }

  let maxBoxHeight = 0;
  boxes.forEach((box) => {
    const textFont = messageFont(conf);
    let totalWidth = box.actorKeys.reduce((total, aKey) => {
      return (total += actors[aKey].width + (actors[aKey].margin || 0));
    }, 0);

    totalWidth -= 2 * conf.boxTextMargin;
    if (box.wrap) {
      box.name = utils.wrapLabel(box.name, totalWidth - 2 * conf.wrapPadding, textFont);
    }

    const boxMsgDimensions = utils.calculateTextDimensions(box.name, textFont);
    maxBoxHeight = common.getMax(boxMsgDimensions.height, maxBoxHeight);
    const minWidth = common.getMax(totalWidth, boxMsgDimensions.width + 2 * conf.wrapPadding);
    box.margin = conf.boxTextMargin;
    if (totalWidth < minWidth) {
      const missing = (minWidth - totalWidth) / 2;
      box.margin += missing;
    }
  });
  boxes.forEach((box) => (box.textMaxHeight = maxBoxHeight));

  return common.getMax(maxHeight, conf.height);
}

const buildNoteModel = function (msg, actors, diagObj) {
  const startx = actors[msg.from].x;
  const stopx = actors[msg.to].x;
  const shouldWrap = msg.wrap && msg.message;

  let textDimensions = utils.calculateTextDimensions(
    shouldWrap ? utils.wrapLabel(msg.message, conf.width, noteFont(conf)) : msg.message,
    noteFont(conf)
  );
  const noteModel = {
    width: shouldWrap
      ? conf.width
      : common.getMax(conf.width, textDimensions.width + 2 * conf.noteMargin),
    height: 0,
    startx: actors[msg.from].x,
    stopx: 0,
    starty: 0,
    stopy: 0,
    message: msg.message,
  };
  if (msg.placement === diagObj.db.PLACEMENT.RIGHTOF) {
    noteModel.width = shouldWrap
      ? common.getMax(conf.width, textDimensions.width)
      : common.getMax(
          actors[msg.from].width / 2 + actors[msg.to].width / 2,
          textDimensions.width + 2 * conf.noteMargin
        );
    noteModel.startx = startx + (actors[msg.from].width + conf.actorMargin) / 2;
  } else if (msg.placement === diagObj.db.PLACEMENT.LEFTOF) {
    noteModel.width = shouldWrap
      ? common.getMax(conf.width, textDimensions.width + 2 * conf.noteMargin)
      : common.getMax(
          actors[msg.from].width / 2 + actors[msg.to].width / 2,
          textDimensions.width + 2 * conf.noteMargin
        );
    noteModel.startx = startx - noteModel.width + (actors[msg.from].width - conf.actorMargin) / 2;
  } else if (msg.to === msg.from) {
    textDimensions = utils.calculateTextDimensions(
      shouldWrap
        ? utils.wrapLabel(
            msg.message,
            common.getMax(conf.width, actors[msg.from].width),
            noteFont(conf)
          )
        : msg.message,
      noteFont(conf)
    );
    noteModel.width = shouldWrap
      ? common.getMax(conf.width, actors[msg.from].width)
      : common.getMax(
          actors[msg.from].width,
          conf.width,
          textDimensions.width + 2 * conf.noteMargin
        );
    noteModel.startx = startx + (actors[msg.from].width - noteModel.width) / 2;
  } else {
    noteModel.width =
      Math.abs(startx + actors[msg.from].width / 2 - (stopx + actors[msg.to].width / 2)) +
      conf.actorMargin;
    noteModel.startx =
      startx < stopx
        ? startx + actors[msg.from].width / 2 - conf.actorMargin / 2
        : stopx + actors[msg.to].width / 2 - conf.actorMargin / 2;
  }
  if (shouldWrap) {
    noteModel.message = utils.wrapLabel(
      msg.message,
      noteModel.width - 2 * conf.wrapPadding,
      noteFont(conf)
    );
  }
  log.debug(
    `NM:[${noteModel.startx},${noteModel.stopx},${noteModel.starty},${noteModel.stopy}:${noteModel.width},${noteModel.height}=${msg.message}]`
  );
  return noteModel;
};

export default {
  bounds,
  drawActors,
  drawActorsPopup,
  setConf,
  draw,
};
