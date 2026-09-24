# Gerador procedural de rios

Simulação 3D de rios com controles interativos, objetos físicos, chuva e ciclo celeste, construída com React, TypeScript e Three.js.

[Abrir demonstração](https://bielzitojr.github.io/gerador-procedural-de-rios/)

## Executar localmente

Com Node.js 24 instalado:

```sh
npm ci
npm run dev
```

Acesse http://localhost:3000. A simulação não precisa de chave do Gemini.

## Verificar e publicar

```sh
npm run lint
npm run build:pages
```

O GitHub Pages publica a pasta `docs` da branch `main`. Após alterações, execute `npm run build:pages` e envie o código e a pasta `docs` ao GitHub.

O arquivo `.npmrc` mantém a resolução de dependências compatível com o projeto exportado do AI Studio. O erro de sintaxe em `riverObjectPhysics.ts` foi corrigido removendo um bloco duplicado fora de um método.
