import{r as Qt,g as te}from"./react-vendor-DDjscz8v.js";function ee(F,Q){for(var P=0;P<Q.length;P++){const M=Q[P];if(typeof M!="string"&&!Array.isArray(M)){for(const D in M)if(D!=="default"&&!(D in F)){const d=Object.getOwnPropertyDescriptor(M,D);d&&Object.defineProperty(F,D,d.get?d:{enumerable:!0,get:()=>M[D]})}}}return Object.freeze(Object.defineProperty(F,Symbol.toStringTag,{value:"Module"}))}var lt={exports:{}},yt;function ne(){return yt||(yt=1,(function(F,Q){(function(P,M){F.exports=M(Qt())})(self,(P=>(()=>{var M={58:(r,l,s)=>{s.d(l,{Z:()=>p});var u=s(864),f=s.n(u),h=s(352),o=s.n(h)()(f());o.push([r.id,`
/* The default splitter within a react-split */
.react-split > .split-container > .splitter .default-splitter {
  box-sizing: border-box;
  height: 100%;
  outline: none;
  overflow: hidden;
  user-select: none;
  width: 100%;
  --default-splitter-line-color: silver;
  --default-splitter-line-hover-color: black;
  --default-splitter-line-margin: 2px;
  --default-splitter-line-size: 3px;
}

.react-split > .split-container.horizontal > .splitter .default-splitter {
  cursor: row-resize;
}

.react-split > .split-container.vertical > .splitter .default-splitter {
  cursor: col-resize;
}

/* The thin line within a default splitter hit area */
.react-split > .split-container > .splitter .default-splitter > .line {
  background: var(--default-splitter-line-color);
}

.react-split > .split-container > .splitter .default-splitter:hover > .line {
  background: var(--default-splitter-line-hover-color);
}

.react-split > .split-container.horizontal > .splitter .default-splitter > .line {
  height: var(--default-splitter-line-size);
  width: 100%;
  margin-top: var(--default-splitter-line-margin);
  margin-left: 0;
}

.react-split > .split-container.vertical > .splitter .default-splitter > .line {
  height: 100%;
  width: var(--default-splitter-line-size);
  margin-top: 0;
  margin-left: var(--default-splitter-line-margin);
}`,"",{version:3,sources:["webpack://./src/defaultSplitter.css"],names:[],mappings:";AACA,8CAA8C;AAC9C;EACE,sBAAsB;EACtB,YAAY;EACZ,aAAa;EACb,gBAAgB;EAChB,iBAAiB;EACjB,WAAW;EACX,qCAAqC;EACrC,0CAA0C;EAC1C,mCAAmC;EACnC,iCAAiC;AACnC;;AAEA;EACE,kBAAkB;AACpB;;AAEA;EACE,kBAAkB;AACpB;;AAEA,qDAAqD;AACrD;EACE,8CAA8C;AAChD;;AAEA;EACE,oDAAoD;AACtD;;AAEA;EACE,yCAAyC;EACzC,WAAW;EACX,+CAA+C;EAC/C,cAAc;AAChB;;AAEA;EACE,YAAY;EACZ,wCAAwC;EACxC,aAAa;EACb,gDAAgD;AAClD",sourcesContent:[`
/* The default splitter within a react-split */
.react-split > .split-container > .splitter .default-splitter {
  box-sizing: border-box;
  height: 100%;
  outline: none;
  overflow: hidden;
  user-select: none;
  width: 100%;
  --default-splitter-line-color: silver;
  --default-splitter-line-hover-color: black;
  --default-splitter-line-margin: 2px;
  --default-splitter-line-size: 3px;
}

.react-split > .split-container.horizontal > .splitter .default-splitter {
  cursor: row-resize;
}

.react-split > .split-container.vertical > .splitter .default-splitter {
  cursor: col-resize;
}

/* The thin line within a default splitter hit area */
.react-split > .split-container > .splitter .default-splitter > .line {
  background: var(--default-splitter-line-color);
}

.react-split > .split-container > .splitter .default-splitter:hover > .line {
  background: var(--default-splitter-line-hover-color);
}

.react-split > .split-container.horizontal > .splitter .default-splitter > .line {
  height: var(--default-splitter-line-size);
  width: 100%;
  margin-top: var(--default-splitter-line-margin);
  margin-left: 0;
}

.react-split > .split-container.vertical > .splitter .default-splitter > .line {
  height: 100%;
  width: var(--default-splitter-line-size);
  margin-top: 0;
  margin-left: var(--default-splitter-line-margin);
}`],sourceRoot:""}]);const p=o},672:(r,l,s)=>{s.d(l,{Z:()=>p});var u=s(864),f=s.n(u),h=s(352),o=s.n(h)()(f());o.push([r.id,`/* The top-level element of the splitter*/
.react-split {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
  --react-split-min-primary: 0;
  --react-split-min-secondary: 0;
  --react-split-primary: 50%;
  --react-split-splitter: 7px;
}

/* The container for the primary pane, splitter, and secondary pane.*/
.react-split > .split-container {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
  display: grid;
}

/* When the container is splitting horizontally */
.react-split > .split-container.horizontal {
  grid-template-columns: 1fr;
  grid-template-rows: minmax(var(--react-split-min-primary),var(--react-split-primary)) var(--react-split-splitter) minmax(var(--react-split-min-secondary), 1fr);
  grid-template-areas: "primary" "split" "secondary";
}

/* When the container is splitting vertical */
.react-split > .split-container.vertical {
  grid-template-columns: minmax(var(--react-split-min-primary),var(--react-split-primary)) var(--react-split-splitter) minmax(var(--react-split-min-secondary), 1fr);
  grid-template-rows: 1fr;
  grid-template-areas: "primary split secondary";
}

/* The primary pane. This is either the left or top depending on the split type */
.react-split > .split-container > .primary {
  grid-area: primary;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
}

.react-split > .split-container.horizontal > .primary {
  height: auto;
  width: 100%;
}

.react-split > .split-container.vertical > .primary {
  height: 100%;
  width: auto;
}

/* The splitter between panes. */
.react-split > .split-container > .splitter {
  grid-area: split;
  background: transparent;
  user-select: none;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
}

.react-split > .split-container.horizontal > .splitter {
  height: auto;
  width: 100%;
  cursor: row-resize;
}

.react-split > .split-container.vertical > .splitter {
  height: 100%;
  width: auto;
  cursor: col-resize;
}

/* The secondary pane. This is either the right or bottom depending on the split type */
.react-split > .split-container >.secondary {
  grid-area: secondary;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
}

.react-split > .split-container.horizontal > .secondary {
  height: auto;
  width: 100%;
}

.react-split > .split-container.vertical > .secondary {
  height: 100%;
  width: auto;
}

/* The content within the primary pane, splitter, or secondary pane.*/
.react-split .full-content {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
}
`,"",{version:3,sources:["webpack://./src/split.css"],names:[],mappings:"AAAA,yCAAyC;AACzC;EACE,WAAW;EACX,YAAY;EACZ,sBAAsB;EACtB,aAAa;EACb,gBAAgB;EAChB,4BAA4B;EAC5B,8BAA8B;EAC9B,0BAA0B;EAC1B,2BAA2B;AAC7B;;AAEA,qEAAqE;AACrE;EACE,WAAW;EACX,YAAY;EACZ,sBAAsB;EACtB,aAAa;EACb,gBAAgB;EAChB,aAAa;AACf;;AAEA,iDAAiD;AACjD;EACE,0BAA0B;EAC1B,+JAA+J;EAC/J,kDAAkD;AACpD;;AAEA,6CAA6C;AAC7C;EACE,kKAAkK;EAClK,uBAAuB;EACvB,8CAA8C;AAChD;;AAEA,iFAAiF;AACjF;EACE,kBAAkB;EAClB,sBAAsB;EACtB,aAAa;EACb,gBAAgB;AAClB;;AAEA;EACE,YAAY;EACZ,WAAW;AACb;;AAEA;EACE,YAAY;EACZ,WAAW;AACb;;AAEA,gCAAgC;AAChC;EACE,gBAAgB;EAChB,uBAAuB;EACvB,iBAAiB;EACjB,sBAAsB;EACtB,aAAa;EACb,gBAAgB;AAClB;;AAEA;EACE,YAAY;EACZ,WAAW;EACX,kBAAkB;AACpB;;AAEA;EACE,YAAY;EACZ,WAAW;EACX,kBAAkB;AACpB;;AAEA,uFAAuF;AACvF;EACE,oBAAoB;EACpB,sBAAsB;EACtB,aAAa;EACb,gBAAgB;AAClB;;AAEA;EACE,YAAY;EACZ,WAAW;AACb;;AAEA;EACE,YAAY;EACZ,WAAW;AACb;;AAEA,qEAAqE;AACrE;EACE,WAAW;EACX,YAAY;EACZ,sBAAsB;EACtB,aAAa;EACb,gBAAgB;AAClB",sourcesContent:[`/* The top-level element of the splitter*/
.react-split {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
  --react-split-min-primary: 0;
  --react-split-min-secondary: 0;
  --react-split-primary: 50%;
  --react-split-splitter: 7px;
}

/* The container for the primary pane, splitter, and secondary pane.*/
.react-split > .split-container {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
  display: grid;
}

/* When the container is splitting horizontally */
.react-split > .split-container.horizontal {
  grid-template-columns: 1fr;
  grid-template-rows: minmax(var(--react-split-min-primary),var(--react-split-primary)) var(--react-split-splitter) minmax(var(--react-split-min-secondary), 1fr);
  grid-template-areas: "primary" "split" "secondary";
}

/* When the container is splitting vertical */
.react-split > .split-container.vertical {
  grid-template-columns: minmax(var(--react-split-min-primary),var(--react-split-primary)) var(--react-split-splitter) minmax(var(--react-split-min-secondary), 1fr);
  grid-template-rows: 1fr;
  grid-template-areas: "primary split secondary";
}

/* The primary pane. This is either the left or top depending on the split type */
.react-split > .split-container > .primary {
  grid-area: primary;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
}

.react-split > .split-container.horizontal > .primary {
  height: auto;
  width: 100%;
}

.react-split > .split-container.vertical > .primary {
  height: 100%;
  width: auto;
}

/* The splitter between panes. */
.react-split > .split-container > .splitter {
  grid-area: split;
  background: transparent;
  user-select: none;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
}

.react-split > .split-container.horizontal > .splitter {
  height: auto;
  width: 100%;
  cursor: row-resize;
}

.react-split > .split-container.vertical > .splitter {
  height: 100%;
  width: auto;
  cursor: col-resize;
}

/* The secondary pane. This is either the right or bottom depending on the split type */
.react-split > .split-container >.secondary {
  grid-area: secondary;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
}

.react-split > .split-container.horizontal > .secondary {
  height: auto;
  width: 100%;
}

.react-split > .split-container.vertical > .secondary {
  height: 100%;
  width: auto;
}

/* The content within the primary pane, splitter, or secondary pane.*/
.react-split .full-content {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
}
`],sourceRoot:""}]);const p=o},352:r=>{r.exports=function(l){var s=[];return s.toString=function(){return this.map((function(u){var f="",h=u[5]!==void 0;return u[4]&&(f+="@supports (".concat(u[4],") {")),u[2]&&(f+="@media ".concat(u[2]," {")),h&&(f+="@layer".concat(u[5].length>0?" ".concat(u[5]):""," {")),f+=l(u),h&&(f+="}"),u[2]&&(f+="}"),u[4]&&(f+="}"),f})).join("")},s.i=function(u,f,h,o,p){typeof u=="string"&&(u=[[null,u,void 0]]);var m={};if(h)for(var E=0;E<this.length;E++){var _=this[E][0];_!=null&&(m[_]=!0)}for(var z=0;z<u.length;z++){var A=[].concat(u[z]);h&&m[A[0]]||(p!==void 0&&(A[5]===void 0||(A[1]="@layer".concat(A[5].length>0?" ".concat(A[5]):""," {").concat(A[1],"}")),A[5]=p),f&&(A[2]&&(A[1]="@media ".concat(A[2]," {").concat(A[1],"}")),A[2]=f),o&&(A[4]?(A[1]="@supports (".concat(A[4],") {").concat(A[1],"}"),A[4]=o):A[4]="".concat(o)),s.push(A))}},s}},864:r=>{r.exports=function(l){var s=l[1],u=l[3];if(!u)return s;if(typeof btoa=="function"){var f=btoa(unescape(encodeURIComponent(JSON.stringify(u)))),h="sourceMappingURL=data:application/json;charset=utf-8;base64,".concat(f),o="/*# ".concat(h," */");return[s].concat([o]).join(`
`)}return[s].join(`
`)}},372:(r,l,s)=>{var u=s(567);function f(){}function h(){}h.resetWarningCache=f,r.exports=function(){function o(E,_,z,A,B,T){if(T!==u){var j=new Error("Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types");throw j.name="Invariant Violation",j}}function p(){return o}o.isRequired=o;var m={array:o,bigint:o,bool:o,func:o,number:o,object:o,string:o,symbol:o,any:o,arrayOf:p,element:o,elementType:o,instanceOf:p,node:o,objectOf:p,oneOf:p,oneOfType:p,shape:p,exact:p,checkPropTypes:h,resetWarningCache:f};return m.PropTypes=m,m}},652:(r,l,s)=>{r.exports=s(372)()},567:r=>{r.exports="SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED"},701:r=>{var l=[];function s(h){for(var o=-1,p=0;p<l.length;p++)if(l[p].identifier===h){o=p;break}return o}function u(h,o){for(var p={},m=[],E=0;E<h.length;E++){var _=h[E],z=o.base?_[0]+o.base:_[0],A=p[z]||0,B="".concat(z," ").concat(A);p[z]=A+1;var T=s(B),j={css:_[1],media:_[2],sourceMap:_[3],supports:_[4],layer:_[5]};if(T!==-1)l[T].references++,l[T].updater(j);else{var L=f(j,o);o.byIndex=E,l.splice(E,0,{identifier:B,updater:L,references:1})}m.push(B)}return m}function f(h,o){var p=o.domAPI(o);return p.update(h),function(m){if(m){if(m.css===h.css&&m.media===h.media&&m.sourceMap===h.sourceMap&&m.supports===h.supports&&m.layer===h.layer)return;p.update(h=m)}else p.remove()}}r.exports=function(h,o){var p=u(h=h||[],o=o||{});return function(m){m=m||[];for(var E=0;E<p.length;E++){var _=s(p[E]);l[_].references--}for(var z=u(m,o),A=0;A<p.length;A++){var B=s(p[A]);l[B].references===0&&(l[B].updater(),l.splice(B,1))}p=z}}},80:r=>{var l={};r.exports=function(s,u){var f=(function(h){if(l[h]===void 0){var o=document.querySelector(h);if(window.HTMLIFrameElement&&o instanceof window.HTMLIFrameElement)try{o=o.contentDocument.head}catch{o=null}l[h]=o}return l[h]})(s);if(!f)throw new Error("Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.");f.appendChild(u)}},182:r=>{r.exports=function(l){var s=document.createElement("style");return l.setAttributes(s,l.attributes),l.insert(s,l.options),s}},850:(r,l,s)=>{r.exports=function(u){var f=s.nc;f&&u.setAttribute("nonce",f)}},236:r=>{r.exports=function(l){var s=l.insertStyleElement(l);return{update:function(u){(function(f,h,o){var p="";o.supports&&(p+="@supports (".concat(o.supports,") {")),o.media&&(p+="@media ".concat(o.media," {"));var m=o.layer!==void 0;m&&(p+="@layer".concat(o.layer.length>0?" ".concat(o.layer):""," {")),p+=o.css,m&&(p+="}"),o.media&&(p+="}"),o.supports&&(p+="}");var E=o.sourceMap;E&&typeof btoa<"u"&&(p+=`
/*# sourceMappingURL=data:application/json;base64,`.concat(btoa(unescape(encodeURIComponent(JSON.stringify(E))))," */")),h.styleTagTransform(p,f,h.options)})(s,l,u)},remove:function(){(function(u){if(u.parentNode===null)return!1;u.parentNode.removeChild(u)})(s)}}}},213:r=>{r.exports=function(l,s){if(s.styleSheet)s.styleSheet.cssText=l;else{for(;s.firstChild;)s.removeChild(s.firstChild);s.appendChild(document.createTextNode(l))}}},359:r=>{r.exports=P}},D={};function d(r){var l=D[r];if(l!==void 0)return l.exports;var s=D[r]={id:r,exports:{}};return M[r](s,s.exports,d),s.exports}d.n=r=>{var l=r&&r.__esModule?()=>r.default:()=>r;return d.d(l,{a:l}),l},d.d=(r,l)=>{for(var s in l)d.o(l,s)&&!d.o(r,s)&&Object.defineProperty(r,s,{enumerable:!0,get:l[s]})},d.g=(function(){if(typeof globalThis=="object")return globalThis;try{return this||new Function("return this")()}catch{if(typeof window=="object")return window}})(),d.o=(r,l)=>Object.prototype.hasOwnProperty.call(r,l),d.r=r=>{typeof Symbol<"u"&&Symbol.toStringTag&&Object.defineProperty(r,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(r,"__esModule",{value:!0})},d.nc=void 0;var tt={};return(()=>{d.r(tt),d.d(tt,{DefaultSplitter:()=>L,Split:()=>Wt});var r=d(359),l=d(701),s=d.n(l),u=d(236),f=d.n(u),h=d(80),o=d.n(h),p=d(850),m=d.n(p),E=d(182),_=d.n(E),z=d(213),A=d.n(z),B=d(58),T={};T.styleTagTransform=A(),T.setAttributes=m(),T.insert=o().bind(null,"head"),T.domAPI=f(),T.insertStyleElement=_(),s()(B.Z,T),B.Z&&B.Z.locals&&B.Z.locals;const j=e=>(e%2==0?2:3)+"px",L=e=>{const{dragging:t,pixelSize:n,color:i="silver",hoverColor:a="gray",dragColor:v="black"}=e,b={"--default-splitter-line-margin":(w=n,`${Math.max(0,Math.floor(w/2)-1)}px`),"--default-splitter-line-size":j(n),"--default-splitter-line-color":t?v:i,"--default-splitter-line-hover-color":t?v:a};var w;return r.createElement("div",{className:"default-splitter",style:b},r.createElement("div",{className:"line"}))};function et(){return et=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var i in n)Object.prototype.hasOwnProperty.call(n,i)&&(e[i]=n[i])}return e},et.apply(this,arguments)}function nt(e,t){return nt=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(n,i){return n.__proto__=i,n},nt(e,t)}var Ct=d(652),S=d.n(Ct),ct=(function(){if(typeof Map<"u")return Map;function e(t,n){var i=-1;return t.some((function(a,v){return a[0]===n&&(i=v,!0)})),i}return(function(){function t(){this.__entries__=[]}return Object.defineProperty(t.prototype,"size",{get:function(){return this.__entries__.length},enumerable:!0,configurable:!0}),t.prototype.get=function(n){var i=e(this.__entries__,n),a=this.__entries__[i];return a&&a[1]},t.prototype.set=function(n,i){var a=e(this.__entries__,n);~a?this.__entries__[a][1]=i:this.__entries__.push([n,i])},t.prototype.delete=function(n){var i=this.__entries__,a=e(i,n);~a&&i.splice(a,1)},t.prototype.has=function(n){return!!~e(this.__entries__,n)},t.prototype.clear=function(){this.__entries__.splice(0)},t.prototype.forEach=function(n,i){i===void 0&&(i=null);for(var a=0,v=this.__entries__;a<v.length;a++){var b=v[a];n.call(i,b[1],b[0])}},t})()})(),rt=typeof window<"u"&&typeof document<"u"&&window.document===document,H=d.g!==void 0&&d.g.Math===Math?d.g:typeof self<"u"&&self.Math===Math?self:typeof window<"u"&&window.Math===Math?window:Function("return this")(),wt=typeof requestAnimationFrame=="function"?requestAnimationFrame.bind(H):function(e){return setTimeout((function(){return e(Date.now())}),1e3/60)},_t=["top","right","bottom","left","width","height","size","weight"],xt=typeof MutationObserver<"u",Bt=(function(){function e(){this.connected_=!1,this.mutationEventsAdded_=!1,this.mutationsObserver_=null,this.observers_=[],this.onTransitionEnd_=this.onTransitionEnd_.bind(this),this.refresh=(function(t,n){var i=!1,a=!1,v=0;function b(){i&&(i=!1,t()),a&&c()}function w(){wt(b)}function c(){var C=Date.now();if(i){if(C-v<2)return;a=!0}else i=!0,a=!1,setTimeout(w,20);v=C}return c})(this.refresh.bind(this))}return e.prototype.addObserver=function(t){~this.observers_.indexOf(t)||this.observers_.push(t),this.connected_||this.connect_()},e.prototype.removeObserver=function(t){var n=this.observers_,i=n.indexOf(t);~i&&n.splice(i,1),!n.length&&this.connected_&&this.disconnect_()},e.prototype.refresh=function(){this.updateObservers_()&&this.refresh()},e.prototype.updateObservers_=function(){var t=this.observers_.filter((function(n){return n.gatherActive(),n.hasActive()}));return t.forEach((function(n){return n.broadcastActive()})),t.length>0},e.prototype.connect_=function(){rt&&!this.connected_&&(document.addEventListener("transitionend",this.onTransitionEnd_),window.addEventListener("resize",this.refresh),xt?(this.mutationsObserver_=new MutationObserver(this.refresh),this.mutationsObserver_.observe(document,{attributes:!0,childList:!0,characterData:!0,subtree:!0})):(document.addEventListener("DOMSubtreeModified",this.refresh),this.mutationEventsAdded_=!0),this.connected_=!0)},e.prototype.disconnect_=function(){rt&&this.connected_&&(document.removeEventListener("transitionend",this.onTransitionEnd_),window.removeEventListener("resize",this.refresh),this.mutationsObserver_&&this.mutationsObserver_.disconnect(),this.mutationEventsAdded_&&document.removeEventListener("DOMSubtreeModified",this.refresh),this.mutationsObserver_=null,this.mutationEventsAdded_=!1,this.connected_=!1)},e.prototype.onTransitionEnd_=function(t){var n=t.propertyName,i=n===void 0?"":n;_t.some((function(a){return!!~i.indexOf(a)}))&&this.refresh()},e.getInstance=function(){return this.instance_||(this.instance_=new e),this.instance_},e.instance_=null,e})(),pt=function(e,t){for(var n=0,i=Object.keys(t);n<i.length;n++){var a=i[n];Object.defineProperty(e,a,{value:t[a],enumerable:!1,writable:!1,configurable:!0})}return e},I=function(e){return e&&e.ownerDocument&&e.ownerDocument.defaultView||H},ut=U(0,0,0,0);function X(e){return parseFloat(e)||0}function ht(e){for(var t=[],n=1;n<arguments.length;n++)t[n-1]=arguments[n];return t.reduce((function(i,a){return i+X(e["border-"+a+"-width"])}),0)}var Ot=typeof SVGGraphicsElement<"u"?function(e){return e instanceof I(e).SVGGraphicsElement}:function(e){return e instanceof I(e).SVGElement&&typeof e.getBBox=="function"};function zt(e){return rt?Ot(e)?(function(t){var n=t.getBBox();return U(0,0,n.width,n.height)})(e):(function(t){var n=t.clientWidth,i=t.clientHeight;if(!n&&!i)return ut;var a=I(t).getComputedStyle(t),v=(function(x){for(var y={},W=0,k=["top","right","bottom","left"];W<k.length;W++){var G=k[W],Z=x["padding-"+G];y[G]=X(Z)}return y})(a),b=v.left+v.right,w=v.top+v.bottom,c=X(a.width),C=X(a.height);if(a.boxSizing==="border-box"&&(Math.round(c+b)!==n&&(c-=ht(a,"left","right")+b),Math.round(C+w)!==i&&(C-=ht(a,"top","bottom")+w)),!(function(x){return x===I(x).document.documentElement})(t)){var R=Math.round(c+b)-n,O=Math.round(C+w)-i;Math.abs(R)!==1&&(c-=R),Math.abs(O)!==1&&(C-=O)}return U(v.left,v.top,c,C)})(e):ut}function U(e,t,n,i){return{x:e,y:t,width:n,height:i}}var Tt=(function(){function e(t){this.broadcastWidth=0,this.broadcastHeight=0,this.contentRect_=U(0,0,0,0),this.target=t}return e.prototype.isActive=function(){var t=zt(this.target);return this.contentRect_=t,t.width!==this.broadcastWidth||t.height!==this.broadcastHeight},e.prototype.broadcastRect=function(){var t=this.contentRect_;return this.broadcastWidth=t.width,this.broadcastHeight=t.height,t},e})(),Rt=function(e,t){var n,i,a,v,b,w,c,C=(i=(n=t).x,a=n.y,v=n.width,b=n.height,w=typeof DOMRectReadOnly<"u"?DOMRectReadOnly:Object,c=Object.create(w.prototype),pt(c,{x:i,y:a,width:v,height:b,top:a,right:i+v,bottom:b+a,left:i}),c);pt(this,{target:e,contentRect:C})},St=(function(){function e(t,n,i){if(this.activeObservations_=[],this.observations_=new ct,typeof t!="function")throw new TypeError("The callback provided as parameter 1 is not a function.");this.callback_=t,this.controller_=n,this.callbackCtx_=i}return e.prototype.observe=function(t){if(!arguments.length)throw new TypeError("1 argument required, but only 0 present.");if(typeof Element<"u"&&Element instanceof Object){if(!(t instanceof I(t).Element))throw new TypeError('parameter 1 is not of type "Element".');var n=this.observations_;n.has(t)||(n.set(t,new Tt(t)),this.controller_.addObserver(this),this.controller_.refresh())}},e.prototype.unobserve=function(t){if(!arguments.length)throw new TypeError("1 argument required, but only 0 present.");if(typeof Element<"u"&&Element instanceof Object){if(!(t instanceof I(t).Element))throw new TypeError('parameter 1 is not of type "Element".');var n=this.observations_;n.has(t)&&(n.delete(t),n.size||this.controller_.removeObserver(this))}},e.prototype.disconnect=function(){this.clearActive(),this.observations_.clear(),this.controller_.removeObserver(this)},e.prototype.gatherActive=function(){var t=this;this.clearActive(),this.observations_.forEach((function(n){n.isActive()&&t.activeObservations_.push(n)}))},e.prototype.broadcastActive=function(){if(this.hasActive()){var t=this.callbackCtx_,n=this.activeObservations_.map((function(i){return new Rt(i.target,i.broadcastRect())}));this.callback_.call(t,n,t),this.clearActive()}},e.prototype.clearActive=function(){this.activeObservations_.splice(0)},e.prototype.hasActive=function(){return this.activeObservations_.length>0},e})(),dt=typeof WeakMap<"u"?new WeakMap:new ct,ft=function e(t){if(!(this instanceof e))throw new TypeError("Cannot call a class as a function.");if(!arguments.length)throw new TypeError("1 argument required, but only 0 present.");var n=Bt.getInstance(),i=new St(t,n,this);dt.set(this,i)};["observe","unobserve","disconnect"].forEach((function(e){ft.prototype[e]=function(){var t;return(t=dt.get(this))[e].apply(t,arguments)}}));const Mt=H.ResizeObserver!==void 0?H.ResizeObserver:ft;var kt=["client","offset","scroll","bounds","margin"];function At(e){var t=[];return kt.forEach((function(n){e[n]&&t.push(n)})),t}function mt(e,t){var n={};if(t.indexOf("client")>-1&&(n.client={top:e.clientTop,left:e.clientLeft,width:e.clientWidth,height:e.clientHeight}),t.indexOf("offset")>-1&&(n.offset={top:e.offsetTop,left:e.offsetLeft,width:e.offsetWidth,height:e.offsetHeight}),t.indexOf("scroll")>-1&&(n.scroll={top:e.scrollTop,left:e.scrollLeft,width:e.scrollWidth,height:e.scrollHeight}),t.indexOf("bounds")>-1){var i=e.getBoundingClientRect();n.bounds={top:i.top,right:i.right,bottom:i.bottom,left:i.left,width:i.width,height:i.height}}if(t.indexOf("margin")>-1){var a=getComputedStyle(e);n.margin={top:a?parseInt(a.marginTop):0,right:a?parseInt(a.marginRight):0,bottom:a?parseInt(a.marginBottom):0,left:a?parseInt(a.marginLeft):0}}return n}function Dt(e){return e&&e.ownerDocument&&e.ownerDocument.defaultView||window}var it=(function(e){var t,n;return n=t=(function(i){var a,v;function b(){for(var c,C=arguments.length,R=new Array(C),O=0;O<C;O++)R[O]=arguments[O];return(c=i.call.apply(i,[this].concat(R))||this).state={contentRect:{entry:{},client:{},offset:{},scroll:{},bounds:{},margin:{}}},c._animationFrameID=null,c._resizeObserver=null,c._node=null,c._window=null,c.measure=function(x){var y=mt(c._node,At(c.props));x&&(y.entry=x[0].contentRect),c._animationFrameID=c._window.requestAnimationFrame((function(){c._resizeObserver!==null&&(c.setState({contentRect:y}),typeof c.props.onResize=="function"&&c.props.onResize(y))}))},c._handleRef=function(x){c._resizeObserver!==null&&c._node!==null&&c._resizeObserver.unobserve(c._node),c._node=x,c._window=Dt(c._node);var y=c.props.innerRef;y&&(typeof y=="function"?y(c._node):y.current=c._node),c._resizeObserver!==null&&c._node!==null&&c._resizeObserver.observe(c._node)},c}v=i,(a=b).prototype=Object.create(v.prototype),a.prototype.constructor=a,nt(a,v);var w=b.prototype;return w.componentDidMount=function(){this._resizeObserver=this._window!==null&&this._window.ResizeObserver?new this._window.ResizeObserver(this.measure):new Mt(this.measure),this._node!==null&&(this._resizeObserver.observe(this._node),typeof this.props.onResize=="function"&&this.props.onResize(mt(this._node,At(this.props))))},w.componentWillUnmount=function(){this._window!==null&&this._window.cancelAnimationFrame(this._animationFrameID),this._resizeObserver!==null&&(this._resizeObserver.disconnect(),this._resizeObserver=null)},w.render=function(){var c=this.props,C=(c.innerRef,c.onResize,(function(R,O){if(R==null)return{};var x,y,W={},k=Object.keys(R);for(y=0;y<k.length;y++)x=k[y],O.indexOf(x)>=0||(W[x]=R[x]);return W})(c,["innerRef","onResize"]));return(0,r.createElement)(e,et({},C,{measureRef:this._handleRef,measure:this.measure,contentRect:this.state.contentRect}))},b})(r.Component),t.propTypes={client:S().bool,offset:S().bool,scroll:S().bool,bounds:S().bool,margin:S().bool,innerRef:S().oneOfType([S().object,S().func]),onResize:S().func},n})((function(e){var t=e.measure,n=e.measureRef,i=e.contentRect;return(0,e.children)({measure:t,measureRef:n,contentRect:i})}));it.displayName="Measure",it.propTypes.children=S().func;const ot=it;var V=d(672),Y={};Y.styleTagTransform=A(),Y.setAttributes=m(),Y.insert=o().bind(null,"head"),Y.domAPI=f(),Y.insertStyleElement=_(),s()(V.Z,Y),V.Z&&V.Z.locals&&V.Z.locals;const Wt=e=>{const{horizontal:t=!1,initialPrimarySize:n="50%",minPrimarySize:i="0px",minSecondarySize:a="0px",splitterSize:v="7px",renderSplitter:b,resetOnDoubleClick:w=!1,defaultSplitterColors:c={color:"silver",hover:"gray",drag:"black"},onSplitChanged:C,onMeasuredSizesChanged:R}=e,[O,x]=r.useState({height:0,width:0}),[y,W]=r.useState({height:0,width:0}),[k,G]=r.useState({height:0,width:0}),Z=r.useMemo((()=>t?O.height:O.width),[t,O]),J=r.useMemo((()=>t?y.height:y.width),[t,y]),$=r.useMemo((()=>t?k.height:k.width),[t,k]),[q,vt]=r.useState(void 0),[jt,Pt]=r.useState(0),[It,Yt]=r.useState(0),[st,gt]=r.useState(!1);r.useEffect((()=>{C&&C(q!==void 0?`${q}%`:n)}),[q,n]),r.useEffect((()=>{R&&R({primary:J,splitter:$,secondary:Z-(J+$)})}),[t,Z,J,$]);const Zt=g=>{g.bounds&&W({height:g.bounds.height,width:g.bounds.width})},Ft=g=>{g.bounds&&G({height:g.bounds.height,width:g.bounds.width})},qt=g=>{g.currentTarget.setPointerCapture(g.pointerId),Pt(t?g.clientY:g.clientX),Yt(J),gt(!0)},Nt=g=>{if(g.currentTarget.hasPointerCapture(g.pointerId)){const N=t?g.clientY:g.clientX,$t=It+(N-jt),Kt=Math.max(0,Math.min($t,Z));vt(Kt/Z*100)}},Lt=g=>{g.currentTarget.releasePointerCapture(g.pointerId),gt(!1)},Ht=()=>{w&&vt(void 0)},K=r.Children.toArray(e.children),Xt=K.length>0?K[0]:r.createElement("div",null),Ut=K.length>1?K[1]:r.createElement("div",null),at={primary:q!==void 0?`${q}%`:n,minPrimary:i??"0px",minSecondary:a??"0px"},bt={pixelSize:$,horizontal:t,dragging:st},Vt=b??(()=>r.createElement(L,Object.assign({},bt,{color:st?c.drag:c.color,hoverColor:st?c.drag:c.hover}))),Gt=t?"split-container horizontal":"split-container vertical",Jt={"--react-split-min-primary":at.minPrimary,"--react-split-min-secondary":at.minSecondary,"--react-split-primary":at.primary,"--react-split-splitter":v};return r.createElement(ot,{bounds:!0,onResize:g=>{g.bounds&&x({height:g.bounds.height,width:g.bounds.width})}},(({measureRef:g})=>r.createElement("div",{className:"react-split",ref:g},r.createElement("div",{className:Gt,style:Jt},r.createElement("div",{className:"primary"},r.createElement(ot,{bounds:!0,onResize:Zt},(({measureRef:N})=>r.createElement("div",{className:"full-content",ref:N},Xt)))),r.createElement("div",{className:"splitter",tabIndex:-1,onPointerDown:qt,onPointerUp:Lt,onPointerMove:Nt,onDoubleClick:Ht},r.createElement(ot,{bounds:!0,onResize:Ft},(({measureRef:N})=>r.createElement("div",{className:"full-content",ref:N},Vt(bt))))),r.createElement("div",{className:"secondary"},r.createElement("div",{className:"full-content"},Ut))))))}})(),tt})()))})(lt)),lt.exports}var Et=ne();const re=te(Et),oe=ee({__proto__:null,default:re},[Et]);export{oe as i};
