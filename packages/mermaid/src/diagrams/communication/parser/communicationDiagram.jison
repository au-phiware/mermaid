/** mermaid
 *  https://mermaidjs.github.io/
 *  (c) 2014-2015 Knut Sveidqvist
 *  MIT license.
 *
 *  Based on js sequence diagrams jison grammr
 *  https://bramp.github.io/js-sequence-diagrams/
 *  (c) 2012-2013 Andrew Brampton (bramp.net)
 *  Simplified BSD license.
 */
%lex

%options case-insensitive

// Special states for recognizing aliases
// A special state for grabbing text up to the first comment/newline
%x ID ALIAS LINE

// Directive states
%x open_directive type_directive arg_directive
%x acc_title
%x acc_descr
%x acc_descr_multiline
%%

\%\%\{                                                          { this.begin('open_directive'); return 'open_directive'; }
.*direction\s+TB[^\n]*                                          return 'direction_tb';
.*direction\s+BT[^\n]*                                          return 'direction_bt';
.*direction\s+RL[^\n]*                                          return 'direction_rl';
.*direction\s+LR[^\n]*                                          return 'direction_lr';
<open_directive>((?:(?!\}\%\%)[^:.])*)                          { this.begin('type_directive'); return 'type_directive'; }
<type_directive>":"                                             { this.popState(); this.begin('arg_directive'); return ':'; }
<type_directive,arg_directive>\}\%\%                            { this.popState(); this.popState(); return 'close_directive'; }
<arg_directive>((?:(?!\}\%\%).|\n)*)                            return 'arg_directive';
[\n]+                                                           return 'NEWLINE';
\s+                                                             /* skip all whitespace */
<ID,ALIAS,LINE>((?!\n)\s)+                                      /* skip same-line whitespace */
<INITIAL,ID,ALIAS,LINE,arg_directive,type_directive,open_directive>\#[^\n]*   /* skip comments */
\%%(?!\{)[^\n]*                                                 /* skip comments */
[^\}]\%\%[^\n]*                                                 /* skip comments */
[0-9]+[a-zA-Z]*(\.\s*[0-9]+[a-zA-Z]*)*\.?(?=[ \n]+)             { yytext = yytext.replace(/\s/g, ''); return 'SEQ'; }
"box"                                                           { this.begin('LINE'); return 'box'; }
"participant"                                                   { this.begin('ID'); return 'participant'; }
"actor"                                                         { this.begin('ID'); return 'participant_actor'; }
<ID>[^\->:\n,;]+?([\-]*[^\->:\n,;]+?)*?(?=((?!\n)\s)+"as"(?!\n)\s|[#\n;]|$)     { yytext = yytext.trim(); this.begin('ALIAS'); return 'ACTOR'; }
<ALIAS>"as"                                                     { this.popState(); this.popState(); this.begin('LINE'); return 'AS'; }
<ALIAS>(?:)                                                     { this.popState(); this.popState(); return 'NEWLINE'; }
<LINE>(?:[:]?(?:no)?wrap:)?[^#\n;]*                             { this.popState(); return 'restOfLine'; }
"end"                                                           return 'end';
"left of"                                                       return 'left_of';
"right of"                                                      return 'right_of';
"links"                                                         return 'links';
"link"                                                          return 'link';
"properties"                                                    return 'properties';
"details"                                                       return 'details';
"over"                                                          return 'over';
"note"                                                          return 'note';
"title"\s[^#\n;]+                                               return 'title';
"title:"\s[^#\n;]+                                              return 'legacy_title';
accTitle\s*":"\s*                                               { this.begin("acc_title");return 'acc_title'; }
<acc_title>(?!\n|;|#)*[^\n]*                                    { this.popState(); return "acc_title_value"; }
accDescr\s*":"\s*                                               { this.begin("acc_descr");return 'acc_descr'; }
<acc_descr>(?!\n|;|#)*[^\n]*                                    { this.popState(); return "acc_descr_value"; }
accDescr\s*"{"\s*                                               { this.begin("acc_descr_multiline");}
<acc_descr_multiline>[\}]                                       { this.popState(); }
<acc_descr_multiline>[^\}]*                                     return "acc_descr_multiline_value";
"communicationDiagram"                                          return 'SD';
"off"                                                           return 'off';
","                                                             return ',';
";"                                                             return 'NEWLINE';
[^\+\->:\n,;]+((?!(\-x|\-\-x|\-\)|\-\-\)))[\-]*[^\+\->:\n,;]+)* { yytext = yytext.trim(); return 'ACTOR'; }
"-->"                                                           return 'ARROW';
":"(?:(?:no)?wrap:)?[^#\n;]+                                    return 'TXT';
"+"                                                             return '+';
"-"                                                             return '-';
<<EOF>>                                                         return 'NEWLINE';
.                                                               return 'INVALID';

/lex

%left '^'

%start start

%% /* language grammar */

start
	: SPACE start
	| NEWLINE start
	| directive start
	| SD document { yy.apply($2);return $2; }
	;

direction
    : direction_tb
    { yy.setDirection('TB');}
    | direction_bt
    { yy.setDirection('BT');}
    | direction_rl
    { yy.setDirection('RL');}
    | direction_lr
    { yy.setDirection('LR');}
    ;

document
	: /* empty */ { $$ = [] }
	| document line {$1.push($2);$$ = $1}
	;

line
	: SPACE statement { $$ = $2 }
	| statement { $$ = $1 }
	| NEWLINE { $$=[]; }
	;

box_section
	: /* empty */ { $$ = [] }
	| box_section box_line {$1.push($2);$$ = $1}
	;

box_line
	: SPACE participant_statement { $$ = $2 }
	| participant_statement { $$ = $1 }
	| NEWLINE { $$=[]; }
	;


directive
  : openDirective typeDirective closeDirective 'NEWLINE'
  | openDirective typeDirective ':' argDirective closeDirective 'NEWLINE'
  ;

statement
	: participant_statement
	| 'box' restOfLine box_section end
	{
		$3.unshift({type: 'boxStart', boxData:yy.parseBoxData($2) });
		$3.push({type: 'boxEnd', boxText:$2});
		$$=$3;}
	| signal 'NEWLINE'
	| note_statement 'NEWLINE'
	| direction
	| links_statement 'NEWLINE'
	| link_statement 'NEWLINE'
	| properties_statement 'NEWLINE'
	| details_statement 'NEWLINE'
	| title {yy.setDiagramTitle($1.substring(6));$$=$1.substring(6);}
	| legacy_title {yy.setDiagramTitle($1.substring(7));$$=$1.substring(7);}
	| acc_title acc_title_value  { $$=$2.trim();yy.setAccTitle($$); }
	| acc_descr acc_descr_value  { $$=$2.trim();yy.setAccDescription($$); }
	| acc_descr_multiline_value { $$=$1.trim();yy.setAccDescription($$); }
	| directive
	;

participant_statement
	: 'participant' actor 'AS' restOfLine 'NEWLINE' {$2.type='addParticipant';$2.description=yy.parseMessage($4); $$=$2;}
	| 'participant' actor 'NEWLINE' {$2.type='addParticipant';$$=$2;}
	| 'participant_actor' actor 'AS' restOfLine 'NEWLINE' {$2.type='addActor';$2.description=yy.parseMessage($4); $$=$2;}
	| 'participant_actor' actor 'NEWLINE' {$2.type='addActor'; $$=$2;}
	;

note_statement
	: 'note' placement actor text2
	{
		$$ = [$3, {type:'addNote', placement:$2, actor:$3.actor, text:$4}];}
	| 'note' text2
	{
		$$ = {type:'addNote', text:$2};}
	;

links_statement
	: 'links' actor text2
	{
		$$ = [$2, {type:'addLinks', actor:$2.actor, text:$3}];
	}
	;

link_statement
	: 'link' actor text2
	{
		$$ = [$2, {type:'addALink', actor:$2.actor, text:$3}];
	}
	;

properties_statement
	: 'properties' actor text2
	{
		$$ = [$2, {type:'addProperties', actor:$2.actor, text:$3}];
	}
	;

details_statement
	: 'details' actor text2
	{
		$$ = [$2, {type:'addDetails', actor:$2.actor, text:$3}];
	}
	;

spaceList
	: SPACE spaceList
	| SPACE
	;
actor_pair
	: actor ',' actor   { $$ = [$1, $3]; }
	| actor             { $$ = $1; }
	;

placement
	: 'left_of'   { $$ = yy.PLACEMENT.LEFTOF; }
	| 'right_of'  { $$ = yy.PLACEMENT.RIGHTOF; }
	;

signal
	: SEQ actor ARROW actor text2
	{ $$ = [$2,$4,{type: 'addMessage', seq:$1, from:$2.actor, to:$4.actor, msg:$5}] }
	;

actor
	: ACTOR {$$={ type: 'addParticipant', actor:$1}}
        ;

text2
	: TXT {$$ = yy.parseMessage($1.trim().substring(1)) }
	;

openDirective
	: open_directive { yy.parseDirective('%%{', 'open_directive'); }
	;

typeDirective
	: type_directive { yy.parseDirective($1, 'type_directive'); }
	;

argDirective
	: arg_directive { $1 = $1.trim().replace(/'/g, '"'); yy.parseDirective($1, 'arg_directive'); }
	;

closeDirective
	: close_directive { yy.parseDirective('}%%', 'close_directive', 'sequence'); }
	;

%%
