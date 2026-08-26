      window.openComplementsModal = function(prodId) {
        const prod = productsList.find(p => p.id === prodId);
        if (!prod) return;

        currentEditingProd = prod;
        currentCompQty = 1;
        currentCompSelections = {};

        const modal = document.getElementById("modal-complements");
        document.getElementById("comp-modal-title").textContent = prod.name;
        document.getElementById("comp-modal-price").textContent = (prod.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const notesInput = document.getElementById("comp-modal-notes");
        if (notesInput) notesInput.value = "";

        const imgEl = document.getElementById("comp-modal-img");
        if (prod.image) {
          imgEl.src = prod.image;
          imgEl.classList.remove("hidden");
        } else {
          imgEl.classList.add("hidden");
        }

        const compDoc = complementsMap[prodId];
        const body = document.getElementById("comp-modal-body");
        body.innerHTML = "";

        if (compDoc && compDoc.groups && compDoc.groups.length > 0) {
          compDoc.groups.forEach((group, gIdx) => {
            currentCompSelections[gIdx] = [];

            const groupDiv = document.createElement("div");
            groupDiv.className = "pt-3 first:pt-0 space-y-2";

            const isReq = group.required;
            const minSel = group.min || (isReq ? 1 : 0);
            const maxSel = group.max || 1;

            groupDiv.innerHTML = `
              <div>
                <h4 class="font-display font-black text-sm text-slate-800">${group.name}</h4>
                <p class="text-[10px] text-slate-400 font-bold">
                  ${isReq ? `<span class="text-red-500 font-extrabold">*Obrigatório</span> • ` : ''} Selecione de ${minSel} até ${maxSel}
                </p>
              </div>
              <div class="space-y-1.5 pt-1">
                ${(group.options || []).map((opt, oIdx) => `
                  <label class="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-amber-50 cursor-pointer transition-colors active:scale-[0.99]">
                    <div class="flex items-center gap-2.5">
                      <input 
                        type="${maxSel === 1 ? 'radio' : 'checkbox'}" 
                        name="comp-group-${gIdx}" 
                        onchange="toggleCompOption(${gIdx}, '${opt.name}', ${opt.price || 0}, ${maxSel})"
                        class="w-4 h-4 text-amber-600 rounded"
                      />
                      <span class="text-xs font-bold text-slate-800">${opt.name}</span>
                    </div>
                    ${opt.price ? `<span class="text-xs font-black text-amber-600">+${(opt.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>` : ''}
                  </label>
                `).join('')}
              </div>
            `;
            body.appendChild(groupDiv);
          });
        } else {
          if (prod.description) {
            body.innerHTML = `
              <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <p class="text-xs text-slate-600 font-medium leading-relaxed">${prod.description}</p>
              </div>
            `;
          } else {
            body.innerHTML = `
              <div class="py-1 text-center">
                <p class="text-xs text-slate-500 font-medium">Defina a quantidade e adicione sua observação abaixo caso desejar.</p>
              </div>
            `;
          }
        }

        updateCompModalTotal();
        modal.classList.remove("hidden");
      };

      window.closeComplementsModal = function() {
        document.getElementById("modal-complements").classList.add("hidden");
      };

      window.changeCompModalQty = function(delta) {
        currentCompQty = Math.max(1, currentCompQty + delta);
        document.getElementById("comp-modal-qty").textContent = currentCompQty;
        updateCompModalTotal();
      };

      window.toggleCompOption = function(groupIndex, optName, optPrice, maxAllowed) {
        if (!currentCompSelections[groupIndex]) currentCompSelections[groupIndex] = [];

        const selArr = currentCompSelections[groupIndex];
        const existingIdx = selArr.findIndex(i => i.optionName === optName);

        if (maxAllowed === 1) {
          currentCompSelections[groupIndex] = [{ groupIndex, optionName: optName, price: optPrice }];
        } else {
          if (existingIdx > -1) {
            selArr.splice(existingIdx, 1);
          } else if (selArr.length < maxAllowed) {
            selArr.push({ groupIndex, optionName: optName, price: optPrice });
          }
        }
        updateCompModalTotal();
      };

      function updateCompModalTotal() {
        if (!currentEditingProd) return;
        let unitPrice = currentEditingProd.price || 0;

        Object.values(currentCompSelections).forEach(arr => {
          arr.forEach(opt => {
            unitPrice += (opt.price || 0);
          });
        });

        const total = unitPrice * currentCompQty;
        document.getElementById("comp-modal-total-btn").textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      }

      window.confirmAddCompToCart = function() {
        if (!currentEditingProd) return;

        const complements = [];
        const compDoc = complementsMap[currentEditingProd.id];

        if (compDoc && compDoc.groups) {
          for (let gIdx = 0; gIdx < compDoc.groups.length; gIdx++) {
            const g = compDoc.groups[gIdx];
            const chosen = currentCompSelections[gIdx] || [];
            if (g.required && chosen.length < (g.min || 1)) {
              alert(`Por favor, selecione as opções em: ${g.name}`);
              return;
            }
            chosen.forEach(c => {
              complements.push({
                groupName: g.name,
                optionName: c.optionName,
                price: c.price || 0
              });
            });
          }
        }

        let unitPrice = currentEditingProd.price || 0;
        complements.forEach(c => unitPrice += (c.price || 0));

        const itemNotes = document.getElementById("comp-modal-notes")?.value.trim() || "";

        totemCart.push({
          productId: currentEditingProd.id,
          product: currentEditingProd,
          quantity: currentCompQty,
          complements: complements,
          notes: itemNotes,
          price: unitPrice
        });

        closeComplementsModal();
        updateTotemCartUI();
        renderTotemProductsGrid();
      };

      // UPDATE TOTEM CART UI
