import { useEffect, useState } from 'react';
import { pharmacyApi } from '../../utils/api';
import { FileText, Plus, Search, Trash2, Edit, Download, Send, CheckCircle } from 'lucide-react';
import Pharmacy_AddPurchaseOrderDialog from '../../components/pharmacy/pharmacy_AddPurchaseOrderDialog';
import Pharmacy_ConfirmDialog from '../../components/pharmacy/pharmacy_ConfirmDialog';

export default function Pharmacy_PurchaseOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    loadOrders();
    loadSettings();
  }, [page, limit, query]);

  const loadOrders = async () => {
    try {
      const res: any = await pharmacyApi.listPurchaseOrders({ q: query, page, limit });
      setOrders(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (error) {
      console.error('Failed to load purchase orders', error);
    }
  };

  const loadSettings = async () => {
    try {
      const s = await pharmacyApi.getSettings();
      setSettings(s);
    } catch (error) {
      console.error('Failed to load pharmacy settings', error);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      await pharmacyApi.createPurchaseOrder(data);
      loadOrders();
    } catch (error) {
      console.error('Failed to create purchase order', error);
    }
  };

  const handleUpdate = async (data: any) => {
    try {
      if (!selectedOrder?._id) return;
      await pharmacyApi.updatePurchaseOrder(selectedOrder._id, data);
      loadOrders();
    } catch (error) {
      console.error('Failed to update purchase order', error);
    }
  };

  const handleMarkAsSent = async (id: string) => {
    try {
      await pharmacyApi.updatePurchaseOrderStatus(id, 'Sent');
      loadOrders();
    } catch (error) {
      console.error('Failed to mark as sent', error);
    }
  };

  const handleMarkAsComplete = async (id: string) => {
    try {
      await pharmacyApi.updatePurchaseOrderStatus(id, 'Complete');
      loadOrders();
    } catch (error) {
      console.error('Failed to mark as complete', error);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await pharmacyApi.deletePurchaseOrder(toDelete);
      loadOrders();
      setConfirmOpen(false);
      setToDelete(null);
    } catch (error) {
      console.error('Failed to delete purchase order', error);
    }
  };

  const handleDownloadPDF = (order: any) => {
    // Basic implementation using window.print style but formatted for the PO as shown in the image
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order - ${order.poNumber}</title>
        <style>
          body { font-family: sans-serif; color: #333; margin: 40px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .pharmacy-info h1 { color: #1e3a8a; margin: 0; font-size: 24px; }
          .pharmacy-info p { margin: 4px 0; color: #666; font-size: 14px; }
          .po-title { text-align: right; }
          .po-title h2 { margin: 0; color: #333; font-size: 18px; text-transform: uppercase; }
          .po-number { color: #1e3a8a; font-weight: bold; font-size: 18px; margin-top: 8px; }
          
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; background: #f8fafc; }
          .info-box h3 { margin: 0 0 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; display: flex; align-items: center; gap: 5px; }
          .info-box p { margin: 4px 0; font-size: 14px; }
          .info-box .name { font-weight: bold; font-size: 16px; margin-bottom: 8px; }

          .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .details-item h3 { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
          .details-item p { margin: 4px 0; font-size: 14px; }

          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase; text-align: left; padding: 10px; border-bottom: 2px solid #e2e8f0; }
          td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          
          .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 60px; }
          .bottom-item h3 { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 10px; }
          .bottom-item p { font-size: 14px; background: #f8fafc; padding: 10px; border-radius: 4px; min-height: 40px; }

          .footer { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; }
          .sig-box { border-top: 1px solid #cbd5e1; padding-top: 10px; }
          .sig-label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 15px; }
          .sig-value { font-weight: bold; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="pharmacy-info">
            ${settings?.logoDataUrl ? `<img src="${settings.logoDataUrl}" alt="Logo" style="height:60px;width:auto;object-fit:contain;margin-bottom:10px"/>` : ''}
            <h1>${settings?.pharmacyName || 'Bin Barkat Pharmacy'}</h1>
            <p>${settings?.address || 'Lahore, Pakistan'}</p>
            <p>Phone: ${settings?.phone || '03099059099'}</p>
          </div>
          <div class="po-title">
            <h2>Purchase Order</h2>
            <div class="po-number">${order.poNumber}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Supplier Information</h3>
            <div class="name">${order.supplierName}</div>
            <p>${order.supplierContact || ''}</p>
            <p>${order.supplierPhone || ''}</p>
          </div>
          <div class="info-box">
            <h3>Company Information</h3>
            <div class="name">${order.companyName || 'MedSynch'}</div>
          </div>
        </div>

        <div class="details-grid">
          <div class="details-item">
            <h3>Order Details</h3>
            <p>Order Date: <strong>${new Date(order.orderDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
            <p>Expected Delivery: <strong>${order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</strong></p>
          </div>
          <div class="details-item">
            <h3>Delivery Address</h3>
            <p>${order.deliveryAddress || 'Gujranwala, Punjab'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px">#</th>
              <th>Item Name</th>
              <th>Category</th>
              <th style="text-align: right">Qty</th>
              <th style="text-align: right">Unit</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((it: any, i: number) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${it.name}</strong></td>
                <td style="color: #64748b">${it.category || '-'}</td>
                <td style="text-align: right"><strong>${it.qty}</strong></td>
                <td style="text-align: right; color: #64748b">${it.unit || 'packs'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="bottom-grid">
          <div class="bottom-item">
            <h3>Notes</h3>
            <p>${order.notes || ''}</p>
          </div>
          <div class="bottom-item">
            <h3>Terms & Conditions</h3>
            <p>${order.terms || ''}</p>
          </div>
        </div>

        <div class="footer">
          <div class="sig-box">
            <div class="sig-label">Authorized By</div>
            <div class="sig-value">${order.authorizedBy || 'Signature'}</div>
          </div>
          <div class="sig-box">
            <div class="sig-label">Date</div>
            <div class="sig-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          <div class="sig-box">
            <div class="sig-label">Stamp</div>
            <div class="sig-value">Official Seal</div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const api = (window as any).electronAPI;
      if (api && typeof api.printPreviewHtml === 'function') {
        api.printPreviewHtml(html);
        return;
      }
    } catch (e) {
      console.error(e);
    }

    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document || frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch (e) {
        console.error(e);
      }
      setTimeout(() => { document.body.removeChild(frame); }, 500);
    };
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header with prominent Create Order button */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-600 p-2 text-white">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Purchase Orders</h2>
            <p className="text-sm text-slate-500">Manage medicine orders from suppliers</p>
          </div>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-md transition-all"
        >
          <Plus className="h-5 w-5" /> 
          <span>Create New Order</span>
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search by PO#, supplier or medicine..."
              className="w-full rounded-md border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Show:</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">PO Number</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orders.map((order) => (
                <tr key={order._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-navy-600">{order.poNumber}</td>
                  <td className="px-6 py-4 text-slate-600">{new Date(order.orderDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{order.supplierName}</div>
                    <div className="text-xs text-slate-500">{order.supplierPhone}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {order.items.length} items
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      order.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                      order.status === 'Sent' ? 'bg-sky-100 text-sky-800' :
                      order.status === 'Complete' || order.status === 'Received' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {order.status === 'Pending' && (
                        <button
                          onClick={() => handleMarkAsSent(order._id)}
                          title="Mark as Sent"
                          className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition-all"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      {order.status === 'Sent' && (
                        <button
                          onClick={() => handleMarkAsComplete(order._id)}
                          title="Mark as Complete"
                          className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadPDF(order)}
                        title="Download/Print PDF"
                        className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-navy-600 transition-all"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setSelectedOrder(order); setEditOpen(true); }}
                        title="Edit Order"
                        className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-navy-600 transition-all"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setToDelete(order._id); setConfirmOpen(true); }}
                        title="Delete Order"
                        className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="rounded-full bg-slate-100 p-4">
                        <FileText className="h-12 w-12 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-lg font-medium text-slate-700">No purchase orders found</p>
                        <p className="text-sm text-slate-500 mt-1">Create your first purchase order to get started</p>
                      </div>
                      <button
                        onClick={() => setAddOpen(true)}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 shadow-md transition-all mt-2"
                      >
                        <Plus className="h-5 w-5" /> 
                        <span>Create New Order</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-500">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} orders
              </div>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Previous
              </button>
              <div className="text-sm font-medium text-slate-700">
                Page {page} of {totalPages}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Pharmacy_AddPurchaseOrderDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleCreate}
      />
      <Pharmacy_AddPurchaseOrderDialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setSelectedOrder(null); }}
        onSave={handleUpdate}
        initial={selectedOrder}
      />
      <Pharmacy_ConfirmDialog
        open={confirmOpen}
        title="Delete Purchase Order"
        message="Are you sure you want to delete this purchase order? This action cannot be undone."
        onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
        onConfirm={handleDelete}
        confirmText="Delete"
      />
    </div>
  );
}
