const fs = require('fs');
let code = fs.readFileSync('whatsapp-bot.ts', 'utf8');

code = code.replace(
/  \}\);\n              \}\);\n  return sessionState\.initialPromise;\n      sock\.ev\.on\('messages\.upsert', async \(m\) => \{/,
`    });
  });

  sock.ev.on('messages.upsert', async (m) => {`
);

code = code.replace(
/    await handleIncomingMessage\(storeId, sock, senderId, text\.trim\(\)\);\n    \}\);\n\}\nasync function handleIncomingMessage/,
`      await handleIncomingMessage(storeId, sock, senderId, text.trim());
    });

    return sessionState.initialPromise;
}
async function handleIncomingMessage`
);

fs.writeFileSync('whatsapp-bot.ts', code);
