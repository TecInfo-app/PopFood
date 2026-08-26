const fs = require('fs');
let content = fs.readFileSync('rapido.html', 'utf8');

const targetStr = content.substring(
    content.indexOf('window.openComplementsModal = function(prodId) {'),
    content.indexOf('function updateTotemCartUI() {')
);

const newStr = `      window.openComplementsModal = function(prodId) {
        const prod = productsList.find(p => p.id === prodId);
        if (!prod) return;
        currentEditingProd = prod;
        currentCompQty = 1;
        currentCompSelections = {}; // Deprecated in favor of DOM read, but kept for compatibility if needed

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
            const groupDiv = document.createElement("div");
            groupDiv.className = "pt-3 first:pt-0 space-y-2";
            
            const isReq = group.isMandatory || group.required;
            let minSel = group.minSelection !== undefined ? group.minSelection : (group.minChoices !== undefined ? group.minChoices : (isReq ? 1 : 0));
            if (typeof minSel === "string") minSel = parseInt(minSel) || 0;
            let maxSel = group.maxSelection !== undefined ? group.maxSelection : (group.maxChoices !== undefined ? group.maxChoices : 1);
            if (typeof maxSel === "string") maxSel = parseInt(maxSel) || 1;
            
            const mandateBadge = isReq 
                ? \`<span class="text-red-500 font-extrabold">*Obrigatório</span> • \` 
                : '';

            groupDiv.innerHTML = \`
              <div>
                <h4 class="font-display font-black text-sm text-slate-800">\${group.name}</h4>
                <p class="text-[10px] text-slate-400 font-bold">
                  \${mandateBadge} Selecione de \${minSel} até \${maxSel}
                </p>
              </div>
              <div class="space-y-1.5 pt-1" id="comp-group-list-\${gIdx}">
              </div>
            \`;
            
            const listDiv = groupDiv.querySelector(\`#comp-group-list-\${gIdx}\`);
            
            (group.options || []).forEach((opt, oIdx) => {
                if (opt.paused) return;
                
                const optId = \`comp-\${gIdx}-\${oIdx}\`;
                const isMulti = maxSel > 1;
                const optDiv = document.createElement("div");
                const formattedPrice = opt.price ? \`+ \${(opt.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\` : '';
                
                if (isMulti) {
                    optDiv.className = "flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50";
                    optDiv.innerHTML = \`
                        <div class="flex items-center gap-2.5">
                            <span class="text-xs font-bold text-slate-800">\${opt.name}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-black text-amber-600">\${formattedPrice}</span>
                            <div class="flex items-center gap-1.5 bg-white rounded-lg p-0.5 border border-slate-200">
                                <button type="button" class="comp-minus-btn w-6 h-6 flex items-center justify-center text-slate-500 rounded active:scale-95 transition-transform" data-optid="\${optId}">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4"></path></svg>
                                </button>
                                <span class="comp-qty text-xs font-bold w-4 text-center text-slate-800" id="qty-\${optId}" data-gidx="\${gIdx}" data-price="\${opt.price || 0}" data-name="\${opt.name}" data-gname="\${group.name}" data-gmin="\${minSel}" data-gmax="\${maxSel}">0</span>
                                <button type="button" class="comp-plus-btn w-6 h-6 flex items-center justify-center text-slate-500 rounded active:scale-95 transition-transform" data-optid="\${optId}">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                                </button>
                            </div>
                        </div>
                    \`;
                } else {
                    const inputType = (maxSel === 1 && isReq) ? 'radio' : 'checkbox';
                    optDiv.innerHTML = \`
                        <label class="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-amber-50 cursor-pointer transition-colors active:scale-[0.99]">
                            <div class="flex items-center gap-2.5">
                                <input 
                                    type="\${inputType}" 
                                    name="comp-group-\${gIdx}" 
                                    class="complement-checkbox w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                    data-gidx="\${gIdx}" data-price="\${opt.price || 0}" data-name="\${opt.name}" data-gname="\${group.name}" data-gmin="\${minSel}" data-gmax="\${maxSel}"
                                    value="\${opt.name}"
                                />
                                <span class="text-xs font-bold text-slate-800">\${opt.name}</span>
                            </div>
                            <span class="text-xs font-black text-amber-600">\${formattedPrice}</span>
                        </label>
                    \`;
                }
                listDiv.appendChild(optDiv);
            });
            body.appendChild(groupDiv);
          });
          
          // Bind Plus/Minus Events
          body.querySelectorAll(".comp-plus-btn").forEach(btn => {
              btn.addEventListener("click", (e) => {
                  e.stopPropagation();
                  const optId = btn.getAttribute("data-optid");
                  const qtySpan = document.getElementById(\`qty-\${optId}\`);
                  const groupName = qtySpan.getAttribute("data-gname");
                  const max = parseInt(qtySpan.getAttribute("data-gmax"));
                  
                  const allQtiesInGroup = body.querySelectorAll(\`.comp-qty[data-gname="\${groupName}"]\`);
                  let totalSelected = 0;
                  allQtiesInGroup.forEach(q => totalSelected += parseInt(q.textContent));
                  
                  if (totalSelected >= max) {
                      Swal.fire({
                          title: 'Atenção!',
                          text: \`Máximo de \${max} opção(ões) para \${groupName}!\`,
                          icon: 'warning',
                          confirmButtonColor: '#f59e0b'
                      });
                      return;
                  }
                  
                  qtySpan.textContent = parseInt(qtySpan.textContent) + 1;
                  updateCompModalTotal();
              });
          });
          
          body.querySelectorAll(".comp-minus-btn").forEach(btn => {
              btn.addEventListener("click", (e) => {
                  e.stopPropagation();
                  const optId = btn.getAttribute("data-optid");
                  const qtySpan = document.getElementById(\`qty-\${optId}\`);
                  let currentVal = parseInt(qtySpan.textContent);
                  if (currentVal > 0) {
                      qtySpan.textContent = currentVal - 1;
                      updateCompModalTotal();
                  }
              });
          });
          
          body.querySelectorAll(".complement-checkbox").forEach(input => {
              input.addEventListener("change", (e) => {
                  if (input.type === "checkbox") {
                      const groupName = input.getAttribute("data-gname");
                      const max = parseInt(input.getAttribute("data-gmax"));
                      const groupInputs = body.querySelectorAll(\`.complement-checkbox[data-gname="\${groupName}"]\`);
                      const checkedCount = Array.from(groupInputs).filter(i => i.checked).length;
                      
                      if (checkedCount > max) {
                          input.checked = false;
                          Swal.fire({
                              title: 'Atenção!',
                              text: \`Máximo de \${max} opção(ões) para \${groupName}!\`,
                              icon: 'warning',
                              confirmButtonColor: '#f59e0b'
                          });
                      } else if (checkedCount === max) {
                          groupInputs.forEach(i => {
                              if (!i.checked) {
                                  i.disabled = true;
                                  i.closest("label").classList.add("opacity-50", "cursor-not-allowed");
                              }
                          });
                      } else {
                          groupInputs.forEach(i => {
                              i.disabled = false;
                              i.closest("label").classList.remove("opacity-50", "cursor-not-allowed");
                          });
                      }
                  }
                  updateCompModalTotal();
              });
          });
          
        } else {
          if (prod.description) {
            body.innerHTML = \`
              <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <p class="text-xs text-slate-600 font-medium leading-relaxed">\${prod.description}</p>
              </div>
            \`;
          } else {
            body.innerHTML = \`
              <div class="py-1 text-center">
                <p class="text-xs text-slate-500 font-medium">Defina a quantidade e adicione sua observação abaixo caso desejar.</p>
              </div>
            \`;
          }
        }

        updateCompModalTotal();
        modal.classList.remove("hidden");
      };

      window.closeComplementsModal = function() {
        document.getElementById("modal-complements").classList.add("hidden");
        currentEditingProd = null;
        currentCompSelections = {};
      };

      window.changeCompModalQty = function(delta) {
        const newQty = currentCompQty + delta;
        if (newQty >= 1) {
          currentCompQty = newQty;
          document.getElementById("comp-modal-qty").textContent = currentCompQty;
          updateCompModalTotal();
        }
      };

      // Kept just in case, but no longer used in new UI
      window.toggleCompOption = function(groupIndex, optName, optPrice, maxAllowed) {
         // Logic moved to DOM listeners
      };

      function updateCompModalTotal() {
        if (!currentEditingProd) return;
        
        let unitPrice = currentEditingProd.price || 0;
        
        // Sum from checkboxes
        document.querySelectorAll(".complement-checkbox:checked").forEach(input => {
            unitPrice += parseFloat(input.getAttribute("data-price") || 0);
        });
        
        // Sum from qty plus/minus
        document.querySelectorAll(".comp-qty").forEach(qtySpan => {
            const qty = parseInt(qtySpan.textContent) || 0;
            if (qty > 0) {
                const price = parseFloat(qtySpan.getAttribute("data-price") || 0);
                unitPrice += (price * qty);
            }
        });

        const total = unitPrice * currentCompQty;
        document.getElementById("comp-modal-total-btn").textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      }

      window.confirmAddCompToCart = function() {
        if (!currentEditingProd) return;

        const activeGroups = {};
        
        // Collect checkboxes
        document.querySelectorAll(".complement-checkbox").forEach(input => {
            const key = input.getAttribute("data-gname");
            if (!activeGroups[key]) {
                activeGroups[key] = {
                    name: key,
                    min: parseInt(input.getAttribute("data-gmin") || 0),
                    max: parseInt(input.getAttribute("data-gmax") || 1),
                    selected: []
                };
            }
            if (input.checked) {
                activeGroups[key].selected.push({
                    optionName: input.value,
                    price: parseFloat(input.getAttribute("data-price") || 0)
                });
            }
        });
        
        // Collect qty inputs
        document.querySelectorAll(".comp-qty").forEach(qtySpan => {
            const key = qtySpan.getAttribute("data-gname");
            if (!activeGroups[key]) {
                activeGroups[key] = {
                    name: key,
                    min: parseInt(qtySpan.getAttribute("data-gmin") || 0),
                    max: parseInt(qtySpan.getAttribute("data-gmax") || 1),
                    selected: []
                };
            }
            const qty = parseInt(qtySpan.textContent) || 0;
            if (qty > 0) {
                const optName = qtySpan.getAttribute("data-name");
                const optPrice = parseFloat(qtySpan.getAttribute("data-price") || 0);
                for (let i = 0; i < qty; i++) {
                    activeGroups[key].selected.push({
                        optionName: optName,
                        price: optPrice
                    });
                }
            }
        });

        // Verify constraints
        for (const groupName in activeGroups) {
            const group = activeGroups[groupName];
            if (group.min > 0 && group.selected.length < group.min) {
                Swal.fire({
                    title: 'Atenção!',
                    text: \`Por favor, selecione no mínimo \${group.min} opção(ões) no grupo "\${groupName}"!\`,
                    icon: 'warning',
                    confirmButtonColor: '#f59e0b'
                });
                return;
            }
            if (group.selected.length > group.max) {
                Swal.fire({
                    title: 'Atenção!',
                    text: \`Excedeu o limite no grupo "\${groupName}": máximo permitido \${group.max} opção(ões).\`,
                    icon: 'warning',
                    confirmButtonColor: '#f59e0b'
                });
                return;
            }
        }

        const complements = [];
        let compPriceTotal = 0;
        for (const key in activeGroups) {
            activeGroups[key].selected.forEach(opt => {
                complements.push({
                    groupName: key,
                    optionName: opt.optionName,
                    price: opt.price
                });
                compPriceTotal += (opt.price || 0);
            });
        }

        const unitPrice = (currentEditingProd.price || 0) + compPriceTotal;
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
`

content = content.replace(targetStr, newStr);
fs.writeFileSync('rapido.html', content);
