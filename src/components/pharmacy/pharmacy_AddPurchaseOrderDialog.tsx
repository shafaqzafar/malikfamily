import React, { useState, useEffect, useRef } from 'react';
import { pharmacyApi } from '../../utils/api';
import { Plus, Trash2, X } from 'lucide-react';

interface Item {
  medicineId?: string;
  name: string;
  category: string;
  qty: number;
  unit: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (order: any) => void;
  initial?: any;
}

const Pharmacy_AddPurchaseOrderDialog: React.FC<Props> = ({ open, onClose, onSave, initial }) => {
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('Signature');

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const itemInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      loadSuppliers();
      loadInventory();
      loadSettings();
      if (initial) {
        setOrderDate(initial.orderDate || '');
        setExpectedDelivery(initial.expectedDelivery || '');
        setSupplierId(initial.supplierId || '');
        setSupplierName(initial.supplierName || '');
        setSupplierPhone(initial.supplierPhone || '');
        setCompanyName(initial.companyName || '');
        setDeliveryAddress(initial.deliveryAddress || '');
        setItems(initial.items || []);
        setNotes(initial.notes || '');
        setTerms(initial.terms || '');
        setAuthorizedBy(initial.authorizedBy || 'Signature');
      } else {
        resetForm();
      }
    }
  }, [open, initial]);

  const resetForm = () => {
    setOrderDate(new Date().toISOString().split('T')[0]);
    setExpectedDelivery('');
    setSupplierId('');
    setSupplierName('');
    setSupplierPhone('');
    setCompanyName('');
    setItems([]);
    setNotes('');
    setTerms('');
  };

  const loadSettings = async () => {
    try {
      const s: any = await pharmacyApi.getSettings();
      if (!initial) {
        setDeliveryAddress((prev) => prev || s?.address || '');
      }
    } catch (error) {
      console.error('Failed to load pharmacy settings', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const res = await pharmacyApi.listAllSuppliers();
      setSuppliers(res.items || []);
    } catch (error) {
      console.error('Failed to load suppliers', error);
    }
  };

  const addItem = () => {
    setItems([...items, { name: '', category: '', qty: 1, unit: 'packs' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const loadInventory = async () => {
    try {
      const res = await pharmacyApi.listInventory({ limit: 1000 });
      setInventory(res.items || []);
    } catch (error) {
      console.error('Failed to load inventory', error);
    }
  };

  const selectInventoryItem = (index: number, item: any) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      medicineId: item._id,
      name: item.name,
      category: item.category || '',
      unit: item.unit || 'packs'
    };
    setItems(newItems);
    setActiveItemIndex(null);
    setItemSearchQuery('');
  };

  const handleItemNameChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], name: value, medicineId: undefined };
    setItems(newItems);
    setActiveItemIndex(index);
    setItemSearchQuery(value);
  };

  const handleItemInputBlur = (e: React.FocusEvent, index: number) => {
    // Delay closing to allow click on dropdown items
    setTimeout(() => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!relatedTarget || !relatedTarget.closest('.inventory-dropdown')) {
        if (activeItemIndex === index) {
          setActiveItemIndex(null);
        }
      }
    }, 150);
  };

  const updateItem = (index: number, field: keyof Item, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSave = () => {
    if (!supplierName || items.length === 0) {
      setToast({ message: 'Please select a supplier and add at least one item.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    onSave({
      orderDate,
      expectedDelivery,
      supplierId,
      supplierName,
      supplierPhone,
      companyName,
      deliveryAddress,
      items,
      notes,
      terms,
      authorizedBy
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-xl font-bold text-slate-800">{initial ? 'Edit' : 'Create'} Purchase Order</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100">
            <X className="h-6 w-6 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Toast Notification */}
          {toast && (
            <div className={`mb-4 rounded-md px-4 py-3 text-sm font-medium ${
              toast.type === 'error' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}>
              {toast.message}
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Pharmacy & Company Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Company Information</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Delivery Address</label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
                  rows={2}
                />
              </div>
            </div>

            {/* Supplier Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Supplier Information</h3>
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700">Select Supplier</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => {
                      setSupplierName(e.target.value);
                      setShowSuppliers(true);
                    }}
                    onFocus={() => setShowSuppliers(true)}
                    placeholder="Search or enter supplier name"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
                  />
                </div>
                {showSuppliers && (
                  <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                    {suppliers
                      .filter(s => s.name.toLowerCase().includes(supplierName.toLowerCase()))
                      .map(s => (
                        <div
                          key={s._id}
                          className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-100"
                          onClick={() => {
                            setSupplierId(s._id);
                            setSupplierName(s.name);
                            setSupplierPhone(s.phone || '');
                            setCompanyName(s.company || '');
                            setShowSuppliers(false);
                          }}
                        >
                          {s.name} {s.phone ? `(${s.phone})` : ''}
                        </div>
                      ))}
                    <div
                      className="cursor-pointer px-3 py-2 text-sm font-medium text-blue-600 hover:bg-slate-100"
                      onClick={() => setShowSuppliers(false)}
                    >
                      + Use Custom Name
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Supplier Phone</label>
                <input
                  type="text"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Order Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Order Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Order Date</label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Expected Delivery</label>
                  <input
                    type="date"
                    value={expectedDelivery}
                    onChange={(e) => setExpectedDelivery(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Order Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-4 w-4" /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-4 py-2 font-medium">Item Name</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 font-medium">Qty</th>
                    <th className="px-4 py-2 font-medium">Unit</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2">
                        <div className="relative">
                          <input
                            ref={el => { itemInputRefs.current[index] = el; }}
                            type="text"
                            value={item.name}
                            onChange={(e) => handleItemNameChange(index, e.target.value)}
                            onFocus={() => { setActiveItemIndex(index); setItemSearchQuery(item.name || ''); }}
                            onBlur={(e) => handleItemInputBlur(e, index)}
                            placeholder="Type to search medicines..."
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                            autoComplete="off"
                          />
                          {activeItemIndex === index && inventory.length > 0 && (
                            <div className="inventory-dropdown absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl">
                              {(itemSearchQuery
                                ? inventory.filter(inv => inv.name?.toLowerCase().includes(itemSearchQuery.toLowerCase()))
                                : inventory.slice(0, 10)
                              ).slice(0, 10).map(inv => (
                                <div
                                  key={inv._id}
                                  className="inventory-dropdown-item cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
                                  onMouseDown={(e) => { e.preventDefault(); selectInventoryItem(index, inv); }}
                                >
                                  <div className="font-medium text-slate-800">{inv.name}</div>
                                  <div className="text-xs text-slate-500">{inv.category || 'General'} • Stock: {inv.stockQty || 0} {inv.unit || 'units'}</div>
                                </div>
                              ))}
                              {itemSearchQuery && inventory.filter(inv => inv.name?.toLowerCase().includes(itemSearchQuery.toLowerCase())).length === 0 && (
                                <div className="px-3 py-2 text-sm text-slate-500">No matching medicines found</div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={item.category}
                          onChange={(e) => updateItem(index, 'category', e.target.value)}
                          placeholder="e.g. Capsule"
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-navy-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateItem(index, 'qty', parseFloat(e.target.value))}
                          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-navy-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-navy-500 focus:outline-none"
                        >
                          <option value="packs">packs</option>
                          <option value="boxes">boxes</option>
                          <option value="units">units</option>
                          <option value="tubes">tubes</option>
                          <option value="bottles">bottles</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No items added yet. Click "+ Add Item" to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
                rows={3}
                placeholder="Any special instructions..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Terms & Conditions</label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
                rows={3}
                placeholder="Terms of the purchase order..."
              />
            </div>
          </div>

          {/* Authorized By */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700">Authorized By (Sign/Label)</label>
            <input
              type="text"
              value={authorizedBy}
              onChange={(e) => setAuthorizedBy(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t bg-slate-50 p-4">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-sm"
          >
            {initial ? 'Update Order' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pharmacy_AddPurchaseOrderDialog;
