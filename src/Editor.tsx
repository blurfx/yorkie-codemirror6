import { useCodeMirror } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Transaction, type ChangeSpec } from '@codemirror/state';
import type { ViewUpdate} from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';
import yorkie from 'yorkie-js-sdk';
import type { Client, Document, TextChange } from 'yorkie-js-sdk';

export default function Editor() {
  const editor = useRef<HTMLDivElement | null>(null);
  const [client, setClient] = useState<Client>();
  const [doc, setDoc] = useState<Document<unknown>>();
  const [code, setCode] = useState('');

  const { setContainer, view } = useCodeMirror({
    container: editor.current,
    extensions: [markdown({ base: markdownLanguage })],
    value: code,
    onChange(value: string, viewUpdate: ViewUpdate) {
      if (!client || !doc) {
        return;
      }
      for (let tr of viewUpdate.transactions) {
        const events = ['select', 'input', 'delete', 'move', 'undo', 'redo'];
        if (!(events.map((event) => tr.isUserEvent(event)).some(Boolean))) {
          continue;
        }
        if (tr.annotation(Transaction.remote)) {
          continue;
        }
        tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
          doc?.update((root) => {
            // @ts-ignore
            root.content.edit(fromA, toA, inserted.toJSON().join('\n'));
          }, `update content byA ${client?.getID()}`);
        });
      }
    },
  });

  const changeEventHandler = (changes: Array<TextChange>) => {
    const clientId = client?.getID();
    const changeSpecs: ChangeSpec[] = changes.filter((change) => change.type === 'content' && change.actor !== clientId).map((change) => ({
      from: Math.max(0, change.from),
      to: Math.max(0, change.to),
      insert: change.content,
    }));
    console.log('changes', changes)
    console.log('changeSpecs', changeSpecs)

    view?.dispatch({
      changes: changeSpecs,
      annotations: [Transaction.remote.of(true)],
    });
  };

  const syncText = (doc: Document<unknown>) => {
    if (doc) {
      // @ts-ignore
      const text = doc.getRoot().content;
      setCode(text.toString());
    }
  };

  useEffect(() => {
    if (doc && view) {
      // @ts-ignore
      const text = doc.getRoot().content;
      text.onChanges(changeEventHandler);
    }
  }, [doc, view]);

  useEffect(() => {
    if (editor.current) {
      setContainer(editor.current);
      (async () => {
        // 01. create client with RPCAddr(envoy) then activate it.
        const client = new yorkie.Client('http://localhost:8080');
        await client.activate();
        console.error('client.id', client.getID());

        // 02. create a document then attach it into the client.
        const doc = new yorkie.Document('codemirror2');
        await client.attach(doc);
        doc.update((root) => {
          // @ts-ignore
          if (!root.content) {
            // @ts-ignore
            root.content = new yorkie.Text();
          }
        }, 'create content if not exists');
        doc.subscribe((event) => {
          if (event.type === 'snapshot') {
            syncText(doc);
          }
        });
        await client.sync();
        // @ts-ignore
        const text = doc.getRoot().content;
        text.onChanges(changeEventHandler);
        syncText(doc);
        setDoc(doc);
        setClient(client);
      })();
    }
  }, [])

  return <div ref={editor} />;
}
