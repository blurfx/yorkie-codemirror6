import type { EditorView } from '@codemirror/view';
import {Facet} from "@codemirror/state";

const yorkieFacet = Facet.define({
  // combine (inputs) {
  //   return inputs[inputs.length - 1]
  // }
})

class YorkiePlugin {
  view: EditorView
  private conf: unknown;
  constructor(view: EditorView) {
    this.view = view;
    this.conf = view.state.facet(yorkieFacet);
  }
}
