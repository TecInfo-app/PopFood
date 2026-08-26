const fs = require('fs');

let content = fs.readFileSync('pedidos.html', 'utf8');

// target 1
content = content.replace(
`        const toCollect = isOnlinePaid ? 0 : total;

        // 2. Generate RAW Plain Text Version for classic text printers
        let textReceipt = "";`,
`        const toCollect = isOnlinePaid ? 0 : total;

        const isMesaAdicao = isMesa && printOnlyNew;

        // 2. Generate RAW Plain Text Version for classic text printers
        let textReceipt = "";`
);

// target 2
content = content.replace(
`        textReceipt += centerText((order.source || order.canal || order.channel || "POPFOOD SITE").toUpperCase());
        textReceipt += centerText(storeName.toUpperCase());
        textReceipt += centerText(printOnlyNew ? "ADICAO DE ITENS" : "EXPEDICAO");
        textReceipt += makeDivider("-");
        textReceipt += centerText(shortId);
        textReceipt += makeDivider("-");

        let detailsText = "";
        detailsText += \`CODIGO DE COLETA: INDISPONIVEL\\n\`;
        detailsText += makeDivider("-");
        detailsText += \`Data: \${orderDate}\\n\`;
        detailsText += \`\${predictionLabel.toUpperCase()} \${estimatedTimeStr}\\n\`;
        detailsText += \`Localizador: \${order.id.slice(-8).toUpperCase()}\\n\`;
        if (order.isFirstOrder || order.customer?.isFirstOrder) {
          detailsText += \`Primeiro pedido!\\n\`;
        }`,
`        textReceipt += centerText((order.source || order.canal || order.channel || "POPFOOD SITE").toUpperCase());
        textReceipt += centerText(storeName.toUpperCase());
        textReceipt += centerText(printOnlyNew ? "ADICAO DE ITENS" : "EXPEDICAO");
        textReceipt += makeDivider("-");
        if (!isMesaAdicao) {
          textReceipt += centerText(shortId);
          textReceipt += makeDivider("-");
        }

        let detailsText = "";
        if (!isMesaAdicao) {
          detailsText += \`CODIGO DE COLETA: INDISPONIVEL\\n\`;
          detailsText += makeDivider("-");
        }
        detailsText += \`Data: \${orderDate}\\n\`;
        detailsText += \`\${predictionLabel.toUpperCase()} \${estimatedTimeStr}\\n\`;
        if (!isMesaAdicao) {
          detailsText += \`Localizador: \${order.id.slice(-8).toUpperCase()}\\n\`;
        }
        if (order.isFirstOrder || order.customer?.isFirstOrder) {
          detailsText += \`Primeiro pedido!\\n\`;
        }`
);

// target 3
content = content.replace(
`        });
        
        detailsText += makeDivider("-");
        if (isOnlinePaid) {
          const isPix = order.paymentMethod === "PixOnline" || 
                        order.paymentMethod === "Pix Imediato" || 
                        order.paymentMethod === "Pix" || 
                        order.paymentMethodType === "pix" ||
                        (order.paymentMethod && order.paymentMethod.toUpperCase().includes("PIX"));
          if (isPix) {
            detailsText += centerText("PIX PAGO ONLINE");
          } else {
            detailsText += centerText("CARTÃO PAGO ONLINE");
          }
        } else {
          detailsText += centerText("* PAGAMENTO NA ENTREGA *");
          const methodUpper = (order.paymentMethod || "").toUpperCase();
          if (methodUpper.includes("PIX")) {
            detailsText += centerText("PIX NA ENTREGA - COBRAR");
          } else if (methodUpper.includes("CART") || methodUpper.includes("CARD")) {
            detailsText += centerText("CARTÃO NA ENTREGA - COBRAR");
          } else if (methodUpper.includes("DINHEIRO")) {
            detailsText += centerText("DINHEIRO - COBRAR");
          } else {
            detailsText += centerText(\`\${methodUpper} - COBRAR\`);
          }
        }
        detailsText += makeDivider("-");
        
        detailsText += formatLine(printOnlyNew ? "Subtotal Acumulado:" : "Valor total do pedido:", \`R$ \${subtotal.toFixed(2).replace(".", ",")}\`);
        detailsText += formatLine("Taxa de entrega:", \`R$ \${deliveryFee.toFixed(2).replace(".", ",")}\`);
        if (discount > 0) {
          detailsText += formatLine("Desconto / Incentivos:", \`-R$ \${discount.toFixed(2).replace(".", ",")}\`);
        }
        detailsText += formatLine(printOnlyNew ? "Total Geral da Mesa:" : "Valor final do pedido:", \`R$ \${total.toFixed(2).replace(".", ",")}\`);
        detailsText += makeDivider("-");
        detailsText += formatLine(printOnlyNew ? "Cobrar da Mesa:" : "Cobrar do cliente:", \`R$ \${toCollect.toFixed(2).replace(".", ",")}\`);
        detailsText += makeDivider("-");
        detailsText += \`CPF na nota: \${order.cpf || order.customer?.cpf || "NÃO INFORMADO"}\\n\`;
        detailsText += makeDivider("-");
        detailsText += centerText("Obrigado pela preferência!");
        detailsText += centerText("PopFood Gestor Web v1.0");

        textReceipt += detailsText;`,
`        });
        
        if (!isMesaAdicao) {
          detailsText += makeDivider("-");
          if (isOnlinePaid) {
            const isPix = order.paymentMethod === "PixOnline" || 
                          order.paymentMethod === "Pix Imediato" || 
                          order.paymentMethod === "Pix" || 
                          order.paymentMethodType === "pix" ||
                          (order.paymentMethod && order.paymentMethod.toUpperCase().includes("PIX"));
            if (isPix) {
              detailsText += centerText("PIX PAGO ONLINE");
            } else {
              detailsText += centerText("CARTÃO PAGO ONLINE");
            }
          } else {
            detailsText += centerText("* PAGAMENTO NA ENTREGA *");
            const methodUpper = (order.paymentMethod || "").toUpperCase();
            if (methodUpper.includes("PIX")) {
              detailsText += centerText("PIX NA ENTREGA - COBRAR");
            } else if (methodUpper.includes("CART") || methodUpper.includes("CARD")) {
              detailsText += centerText("CARTÃO NA ENTREGA - COBRAR");
            } else if (methodUpper.includes("DINHEIRO")) {
              detailsText += centerText("DINHEIRO - COBRAR");
            } else {
              detailsText += centerText(\`\${methodUpper} - COBRAR\`);
            }
          }
          detailsText += makeDivider("-");
          
          detailsText += formatLine(printOnlyNew ? "Subtotal Acumulado:" : "Valor total do pedido:", \`R$ \${subtotal.toFixed(2).replace(".", ",")}\`);
          detailsText += formatLine("Taxa de entrega:", \`R$ \${deliveryFee.toFixed(2).replace(".", ",")}\`);
          if (discount > 0) {
            detailsText += formatLine("Desconto / Incentivos:", \`-R$ \${discount.toFixed(2).replace(".", ",")}\`);
          }
          detailsText += formatLine(printOnlyNew ? "Total Geral da Mesa:" : "Valor final do pedido:", \`R$ \${total.toFixed(2).replace(".", ",")}\`);
          detailsText += makeDivider("-");
          detailsText += formatLine(printOnlyNew ? "Cobrar da Mesa:" : "Cobrar do cliente:", \`R$ \${toCollect.toFixed(2).replace(".", ",")}\`);
          detailsText += makeDivider("-");
          detailsText += \`CPF na nota: \${order.cpf || order.customer?.cpf || "NÃO INFORMADO"}\\n\`;
          detailsText += makeDivider("-");
          detailsText += centerText("Obrigado pela preferência!");
          detailsText += centerText("PopFood Gestor Web v1.0");
        } else {
          detailsText += makeDivider("-");
        }

        textReceipt += detailsText;`
);


// target 4: HTML header part
content = content.replace(
`          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          
          <!-- GIGANTIC HIGH-CONTRAST ORDER BLOCK -->
          <div style="background: black; color: white; text-align: center; font-size: \${orderFontSize}; font-weight: 900; padding: 12px 0; margin: 6px 0; font-family: \${fontStack}; line-height: 1; letter-spacing: 1px;">
            \${shortId}
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          
          <div style="text-align: center; margin: 4px 0;">
            CODIGO DE COLETA: INDISPONIVEL
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          
          <div>Data: \${orderDate}</div>
          
          <div style="background: black; color: white; padding: 4px; text-align: center; font-weight: 900; margin: 6px 0; letter-spacing: 0.5px;">
            \${predictionLabel.toUpperCase()} \${estimatedTimeStr}
          </div>
          
          <div>Localizador: \${order.id.slice(-8).toUpperCase()}</div>
          \${order.isFirstOrder || order.customer?.isFirstOrder 
            ? \`<div style="font-weight: 900; background: #eee; padding: 2px 4px; display: inline-block; margin-top: 2px;">PRIMEIRO PEDIDO!</div>\` 
            : ""
          }`,
`          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          
          \${!isMesaAdicao ? \`
          <!-- GIGANTIC HIGH-CONTRAST ORDER BLOCK -->
          <div style="background: black; color: white; text-align: center; font-size: \${orderFontSize}; font-weight: 900; padding: 12px 0; margin: 6px 0; font-family: \${fontStack}; line-height: 1; letter-spacing: 1px;">
            \${shortId}
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          
          <div style="text-align: center; margin: 4px 0;">
            CODIGO DE COLETA: INDISPONIVEL
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          \` : ""}
          
          <div>Data: \${orderDate}</div>
          
          <div style="background: black; color: white; padding: 4px; text-align: center; font-weight: 900; margin: 6px 0; letter-spacing: 0.5px;">
            \${predictionLabel.toUpperCase()} \${estimatedTimeStr}
          </div>
          
          \${!isMesaAdicao ? \`
          <div>Localizador: \${order.id.slice(-8).toUpperCase()}</div>
          \` : ""}
          \${order.isFirstOrder || order.customer?.isFirstOrder 
            ? \`<div style="font-weight: 900; background: #eee; padding: 2px 4px; display: inline-block; margin-top: 2px;">PRIMEIRO PEDIDO!</div>\` 
            : ""
          }`
);


// target 5: HTML footer part
content = content.replace(
`          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 8px 0;"></div>
          
          <!-- PAYMENT STATUS BANNER -->
          <div style="text-align: center; font-weight: 900; line-height: 1.3; margin: 6px 0; font-size: \${headerFontSize};">
            \${
              isOnlinePaid
                ? (order.paymentMethod === "PixOnline" || order.paymentMethod === "Pix Imediato" || order.paymentMethod === "Pix" || order.paymentMethodType === "pix" || (order.paymentMethod && order.paymentMethod.toUpperCase().includes("PIX"))
                  ? "PIX PAGO ONLINE"
                  : "CARTÃO PAGO ONLINE")
                : (function() {
                    const m = (order.paymentMethod || "").toUpperCase();
                    if (m.includes("PIX")) return "* PAGAMENTO NA ENTREGA *<br>PIX NA ENTREGA - COBRAR";
                    if (m.includes("CART") || m.includes("CARD")) return "* PAGAMENTO NA ENTREGA *<br>CARTÃO NA ENTREGA - COBRAR";
                    if (m.includes("DINHEIRO")) return "* PAGAMENTO NA ENTREGA *<br>DINHEIRO - COBRAR";
                    return \`* PAGAMENTO NA ENTREGA *<br>\${m} - COBRAR\`;
                  })()
            }
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 8px 0;"></div>
          
          <!-- TOTALS -->
          <div style="display: flex; justify-content: space-between; margin-top: 3px;">
            <span>\${printOnlyNew ? "Subtotal Acumulado:" : "Valor total do pedido:"}</span>
            <span style="white-space: nowrap; margin-left: 8px; flex-shrink: 0;">R$ \${subtotal.toFixed(2).replace(".", ",")}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 3px;">
            <span>Taxa de entrega:</span>
            <span style="white-space: nowrap; margin-left: 8px; flex-shrink: 0;">R$ \${deliveryFee.toFixed(2).replace(".", ",")}</span>
          </div>
          \${discountHtml}
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 3px;">
            <span>\${printOnlyNew ? "Total Geral da Mesa:" : "Valor final do pedido:"}</span>
            <span style="white-space: nowrap; margin-left: 8px; flex-shrink: 0;">R$ \${total.toFixed(2).replace(".", ",")}</span>
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          
          <!-- COBRAR DO CLIENTE (CRITICAL HIGHLIGHT) -->
          <div style="display: flex; justify-content: space-between; font-weight: 900; border: 1.5px solid black; padding: 6px; margin: 8px 0; background: #eee;">
            <span>\${printOnlyNew ? "COBRAR DA MESA:" : "COBRAR DO CLIENTE:"}</span>
            <span style="white-space: nowrap; margin-left: 8px; flex-shrink: 0;">R$ \${toCollect.toFixed(2).replace(".", ",")}</span>
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          
          <div style="text-align: center; margin: 4px 0;">
            CPF na nota: \${order.cpf || order.customer?.cpf || "NÃO INFORMADO"}
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          
          <div style="text-align: center; margin-top: 6px; font-weight: normal;">
            Obrigado pela preferência!
          </div>
          <div style="text-align: center; font-size: 10px; margin-top: 2px; font-weight: normal; color: #555;">
            PopFood Gestor Web v1.0
          </div>
        </div>`,
`          \${!isMesaAdicao ? \`
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 8px 0;"></div>
          
          <!-- PAYMENT STATUS BANNER -->
          <div style="text-align: center; font-weight: 900; line-height: 1.3; margin: 6px 0; font-size: \${headerFontSize};">
            \${
              isOnlinePaid
                ? (order.paymentMethod === "PixOnline" || order.paymentMethod === "Pix Imediato" || order.paymentMethod === "Pix" || order.paymentMethodType === "pix" || (order.paymentMethod && order.paymentMethod.toUpperCase().includes("PIX"))
                  ? "PIX PAGO ONLINE"
                  : "CARTÃO PAGO ONLINE")
                : (function() {
                    const m = (order.paymentMethod || "").toUpperCase();
                    if (m.includes("PIX")) return "* PAGAMENTO NA ENTREGA *<br>PIX NA ENTREGA - COBRAR";
                    if (m.includes("CART") || m.includes("CARD")) return "* PAGAMENTO NA ENTREGA *<br>CARTÃO NA ENTREGA - COBRAR";
                    if (m.includes("DINHEIRO")) return "* PAGAMENTO NA ENTREGA *<br>DINHEIRO - COBRAR";
                    return \\\`* PAGAMENTO NA ENTREGA *<br>\\\${m} - COBRAR\\\`;
                  })()
            }
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 8px 0;"></div>
          
          <!-- TOTALS -->
          <div style="display: flex; justify-content: space-between; margin-top: 3px;">
            <span>\${printOnlyNew ? "Subtotal Acumulado:" : "Valor total do pedido:"}</span>
            <span style="white-space: nowrap; margin-left: 8px; flex-shrink: 0;">R$ \${subtotal.toFixed(2).replace(".", ",")}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 3px;">
            <span>Taxa de entrega:</span>
            <span style="white-space: nowrap; margin-left: 8px; flex-shrink: 0;">R$ \${deliveryFee.toFixed(2).replace(".", ",")}</span>
          </div>
          \${discountHtml}
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 3px;">
            <span>\${printOnlyNew ? "Total Geral da Mesa:" : "Valor final do pedido:"}</span>
            <span style="white-space: nowrap; margin-left: 8px; flex-shrink: 0;">R$ \${total.toFixed(2).replace(".", ",")}</span>
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          
          <!-- COBRAR DO CLIENTE (CRITICAL HIGHLIGHT) -->
          <div style="display: flex; justify-content: space-between; font-weight: 900; border: 1.5px solid black; padding: 6px; margin: 8px 0; background: #eee;">
            <span>\${printOnlyNew ? "COBRAR DA MESA:" : "COBRAR DO CLIENTE:"}</span>
            <span style="white-space: nowrap; margin-left: 8px; flex-shrink: 0;">R$ \${toCollect.toFixed(2).replace(".", ",")}</span>
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          
          <div style="text-align: center; margin: 4px 0;">
            CPF na nota: \${order.cpf || order.customer?.cpf || "NÃO INFORMADO"}
          </div>
          
          <!-- dashed separator -->
          <div style="border-top: 1px dashed black; margin: 6px 0;"></div>
          
          <div style="text-align: center; margin-top: 6px; font-weight: normal;">
            Obrigado pela preferência!
          </div>
          <div style="text-align: center; font-size: 10px; margin-top: 2px; font-weight: normal; color: #555;">
            PopFood Gestor Web v1.0
          </div>
          \` : ""}
        </div>`
);


fs.writeFileSync('pedidos.html', content);
console.log('Updated successfully');
