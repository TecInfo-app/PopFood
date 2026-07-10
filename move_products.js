    window.moveProductSorting = async function(prdId, dir) {
      const prd = activeProducts.find(p => p.id === prdId);
      if (!prd) return;
      const catProducts = activeProducts.filter(p => p.categoryId === prd.categoryId).sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = catProducts.findIndex(p => p.id === prdId);
      if (idx === 0 && dir === -1) return;
      if (idx === catProducts.length - 1 && dir === 1) return;
      
      const targetIdx = idx + dir;
      const other = catProducts[targetIdx];
      
      const tempOrder = prd.order || 0;
      prd.order = other.order || 0;
      other.order = tempOrder;
      
      // If order is the same (happens if none was set), just use index
      if (prd.order === other.order) {
        prd.order = targetIdx;
        other.order = idx;
      }
      
      try {
        await updateDoc(doc(db, COLLECTIONS.products, prd.id), { order: prd.order });
        await updateDoc(doc(db, COLLECTIONS.products, other.id), { order: other.order });
      } catch (err) {
        console.error("Erro ao reordenar produtos: ", err);
      }
    }
