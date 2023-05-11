import mermaidAPI from '../../mermaidAPI.js';
import * as configApi from '../../config.js';
import { log } from '../../logger.js';
import { sanitizeText } from '../common/common.js';
import {
  setAccTitle,
  getAccTitle,
  setDiagramTitle,
  getDiagramTitle,
  getAccDescription,
  setAccDescription,
  clear as commonClear,
} from '../../commonDb.js';

let prevActor = undefined;
let actors = {};
let boxes = [];
let messages = [];
const notes = [];
let wrapEnabled;
let currentBox = undefined;

let direction = 'TB';
const getDirection = () => direction;
const setDirection = (dir) => {
  direction = dir;
};

export const parseDirective = function (statement, context, type) {
  mermaidAPI.parseDirective(this, statement, context, type);
};

export const addBox = function (data) {
  boxes.push({
    name: data.text,
    wrap: (data.wrap === undefined && autoWrap()) || !!data.wrap,
    fill: data.color,
    actorKeys: [],
  });
  currentBox = boxes.slice(-1)[0];
};

export const addActor = function (id, name, description, type) {
  let assignedBox = currentBox;
  const old = actors[id];
  if (old) {
    // If already set and trying to set to a new one throw error
    if (currentBox && old.box && currentBox !== old.box) {
      throw new Error(
        'A same participant should only be defined in one Box: ' +
          old.name +
          " can't be in '" +
          old.box.name +
          "' and in '" +
          currentBox.name +
          "' at the same time."
      );
    }

    // Don't change the box if already
    assignedBox = old.box ? old.box : currentBox;
    old.box = assignedBox;

    // Don't allow description nulling
    if (old && name === old.name && description == null) {
      return;
    }
  }

  // Don't allow null descriptions, either
  if (description == null || description.text == null) {
    description = { text: name, wrap: null, type };
  }
  if (type == null || description.text == null) {
    description = { text: name, wrap: null, type };
  }

  actors[id] = {
    box: assignedBox,
    name: name,
    description: description.text,
    wrap: (description.wrap === undefined && autoWrap()) || !!description.wrap,
    prevActor: prevActor,
    links: {},
    properties: {},
    actorCnt: null,
    rectData: null,
    type: type || 'participant',
  };
  if (prevActor && actors[prevActor]) {
    actors[prevActor].nextActor = id;
  }

  if (currentBox) {
    currentBox.actorKeys.push(id);
  }
  prevActor = id;
};

export const addMessage = function (seq, idFrom, idTo, message) {
  messages.push({
    from: idFrom,
    to: idTo,
    seq: seq,
    message: message.text,
    wrap: (message.wrap === undefined && autoWrap()) || !!message.wrap,
  });
};

export const addSignal = function (
  seq,
  idFrom,
  idTo,
  message = { text: undefined, wrap: undefined }
) {
  messages.push({
    from: idFrom,
    to: idTo,
    seq: seq,
    message: message.text,
    wrap: (message.wrap === undefined && autoWrap()) || !!message.wrap,
  });
  return true;
};

export const hasAtLeastOneBox = function () {
  return boxes.length > 0;
};

export const hasAtLeastOneBoxWithTitle = function () {
  return boxes.some((b) => b.name);
};

export const getMessages = function () {
  return messages;
};

export const getBoxes = function () {
  return boxes;
};
export const getActors = function () {
  return actors;
};
export const getActor = function (id) {
  return actors[id];
};
export const getActorKeys = function () {
  return Object.keys(actors);
};

export const setWrap = function (wrapSetting) {
  wrapEnabled = wrapSetting;
};

export const autoWrap = () => {
  // if setWrap has been called, use that value, otherwise use the value from the config
  // TODO: refactor, always use the config value let setWrap update the config value
  if (wrapEnabled !== undefined) {
    return wrapEnabled;
  }
  return configApi.getConfig().communication.wrap;
};

export const clear = function () {
  actors = {};
  boxes = [];
  messages = [];
  commonClear();
};

export const parseMessage = function (str) {
  const _str = str.trim();
  const message = {
    text: _str.replace(/^:?(?:no)?wrap:/, '').trim(),
    wrap:
      _str.match(/^:?wrap:/) !== null
        ? true
        : _str.match(/^:?nowrap:/) !== null
        ? false
        : undefined,
  };
  log.debug('parseMessage:', message);
  return message;
};

// We expect the box statement to be color first then description
// The color can be rgb,rgba,hsl,hsla, or css code names  #hex codes are not supported for now because of the way the char # is handled
// We extract first segment as color, the rest of the line is considered as text
export const parseBoxData = function (str) {
  const match = str.match(/^((?:rgba?|hsla?)\s*\(.*\)|\w*)(.*)$/);
  let color = match != null && match[1] ? match[1].trim() : 'transparent';
  let title = match != null && match[2] ? match[2].trim() : undefined;

  // check that the string is a color
  if (window && window.CSS) {
    if (!window.CSS.supports('color', color)) {
      color = 'transparent';
      title = str.trim();
    }
  } else {
    const style = new Option().style;
    style.color = color;
    if (style.color !== color) {
      color = 'transparent';
      title = str.trim();
    }
  }

  const boxData = {
    color: color,
    text:
      title !== undefined
        ? sanitizeText(title.replace(/^:?(?:no)?wrap:/, ''), configApi.getConfig())
        : undefined,
    wrap:
      title !== undefined
        ? title.match(/^:?wrap:/) !== null
          ? true
          : title.match(/^:?nowrap:/) !== null
          ? false
          : undefined
        : undefined,
  };
  return boxData;
};

export const LINETYPE = {
  SOLID: 0,
  DOTTED: 1,
  NOTE: 2,
  SOLID_CROSS: 3,
  DOTTED_CROSS: 4,
  SOLID_OPEN: 5,
  DOTTED_OPEN: 6,
};

export const ARROWTYPE = {
  FILLED: 0,
  OPEN: 1,
};

export const PLACEMENT = {
  LEFTOF: 0,
  RIGHTOF: 1,
  OVER: 2,
};

export const addNote = function (actor, placement, message) {
  const note = {
    actor: actor,
    placement: placement,
    message: message.text,
    wrap: (message.wrap === undefined && autoWrap()) || !!message.wrap,
  };
  notes.push(note);

  if (!actor) {
    return;
  }

  // Coerce actor into a [to, from, ...] array
  // eslint-disable-next-line unicorn/prefer-spread
  const actors = [].concat(actor, actor);

  messages.push({
    from: actors[0],
    to: actors[1],
    message: message.text,
    wrap: (message.wrap === undefined && autoWrap()) || !!message.wrap,
    type: LINETYPE.NOTE,
    placement: placement,
  });
};

export const addLinks = function (actorId, text) {
  // find the actor
  const actor = getActor(actorId);
  // JSON.parse the text
  try {
    let sanitizedText = sanitizeText(text.text, configApi.getConfig());
    sanitizedText = sanitizedText.replace(/&amp;/g, '&');
    sanitizedText = sanitizedText.replace(/&equals;/g, '=');
    const links = JSON.parse(sanitizedText);
    // add the deserialized text to the actor's links field.
    insertLinks(actor, links);
  } catch (e) {
    log.error('error while parsing actor link text', e);
  }
};

export const addALink = function (actorId, text) {
  // find the actor
  const actor = getActor(actorId);
  try {
    const links = {};
    let sanitizedText = sanitizeText(text.text, configApi.getConfig());
    var sep = sanitizedText.indexOf('@');
    sanitizedText = sanitizedText.replace(/&amp;/g, '&');
    sanitizedText = sanitizedText.replace(/&equals;/g, '=');
    var label = sanitizedText.slice(0, sep - 1).trim();
    var link = sanitizedText.slice(sep + 1).trim();

    links[label] = link;
    // add the deserialized text to the actor's links field.
    insertLinks(actor, links);
  } catch (e) {
    log.error('error while parsing actor link text', e);
  }
};

/**
 * @param {any} actor
 * @param {any} links
 */
function insertLinks(actor, links) {
  if (actor.links == null) {
    actor.links = links;
  } else {
    for (let key in links) {
      actor.links[key] = links[key];
    }
  }
}

export const addProperties = function (actorId, text) {
  // find the actor
  const actor = getActor(actorId);
  // JSON.parse the text
  try {
    let sanitizedText = sanitizeText(text.text, configApi.getConfig());
    const properties = JSON.parse(sanitizedText);
    // add the deserialized text to the actor's property field.
    insertProperties(actor, properties);
  } catch (e) {
    log.error('error while parsing actor properties text', e);
  }
};

/**
 * @param {any} actor
 * @param {any} properties
 */
function insertProperties(actor, properties) {
  if (actor.properties == null) {
    actor.properties = properties;
  } else {
    for (let key in properties) {
      actor.properties[key] = properties[key];
    }
  }
}

/**
 *
 */
function boxEnd() {
  currentBox = undefined;
}

export const addDetails = function (actorId, text) {
  // find the actor
  const actor = getActor(actorId);
  const elem = document.getElementById(text.text);

  // JSON.parse the text
  try {
    const text = elem.innerHTML;
    const details = JSON.parse(text);
    // add the deserialized text to the actor's property field.
    if (details['properties']) {
      insertProperties(actor, details['properties']);
    }

    if (details['links']) {
      insertLinks(actor, details['links']);
    }
  } catch (e) {
    log.error('error while parsing actor details text', e);
  }
};

export const getActorProperty = function (actor, key) {
  if (actor !== undefined && actor.properties !== undefined) {
    return actor.properties[key];
  }

  return undefined;
};

export const apply = function (param) {
  if (Array.isArray(param)) {
    param.forEach(function (item) {
      apply(item);
    });
  } else {
    switch (param.type) {
      case 'addParticipant':
        addActor(param.actor, param.actor, param.description, 'participant');
        break;
      case 'addActor':
        addActor(param.actor, param.actor, param.description, 'actor');
        break;
      case 'addNote':
        addNote(param.actor, param.placement, param.text);
        break;
      case 'addLinks':
        addLinks(param.actor, param.text);
        break;
      case 'addALink':
        addALink(param.actor, param.text);
        break;
      case 'addProperties':
        addProperties(param.actor, param.text);
        break;
      case 'addDetails':
        addDetails(param.actor, param.text);
        break;
      case 'addMessage':
        addSignal(param.seq, param.from, param.to, param.msg);
        break;
      case 'boxStart':
        addBox(param.boxData);
        break;
      case 'boxEnd':
        boxEnd();
        break;
      case 'setAccTitle':
        setAccTitle(param.text);
        break;
    }
  }
};

export default {
  addActor,
  addMessage,
  addSignal,
  addLinks,
  addDetails,
  addProperties,
  autoWrap,
  setWrap,
  getMessages,
  getActors,
  getActor,
  getActorKeys,
  getActorProperty,
  getAccTitle,
  getBoxes,
  getDiagramTitle,
  setDiagramTitle,
  getDirection,
  setDirection,
  parseDirective,
  getConfig: () => configApi.getConfig().communication,
  clear,
  parseMessage,
  parseBoxData,
  LINETYPE,
  ARROWTYPE,
  PLACEMENT,
  addNote,
  setAccTitle,
  apply,
  setAccDescription,
  getAccDescription,
  hasAtLeastOneBox,
  hasAtLeastOneBoxWithTitle,
};
