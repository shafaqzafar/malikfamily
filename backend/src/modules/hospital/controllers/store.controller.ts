import { Request, Response } from 'express'
import { StoreCategoryModel } from '../models/StoreCategory'
import { StoreSupplierModel } from '../models/StoreSupplier'
import { StoreItemModel } from '../models/StoreItem'
import { StoreBatchModel } from '../models/StoreBatch'
import { StorePurchaseModel } from '../models/StorePurchase'
import { StoreIssueModel } from '../models/StoreIssue'
import { StoreSupplierPaymentModel } from '../models/StoreSupplierPayment'
import { StoreAlertModel } from '../models/StoreAlert'
import { HospitalDepartment } from '../models/Department'

// Pagination helper
const getPagination = (query: any) => {
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

// ==================== DASHBOARD ====================
export const storeDashboard = async (req: Request, res: Response) => {
  try {
    const [totalItems, lowStock, outOfStock, expiringSoon, totalValue, recentPurchases, pendingPayments, totalSuppliers, todayPurchases, todayIssues] = await Promise.all([
      StoreItemModel.countDocuments({ active: true }),
      StoreItemModel.countDocuments({ active: true, $expr: { $and: [{ $gt: ['$currentStock', 0] }, { $lt: ['$currentStock', '$minStock'] }] } }),
      StoreItemModel.countDocuments({ active: true, currentStock: 0 }),
      StoreBatchModel.countDocuments({ active: true, expiry: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), $gt: new Date() }, quantity: { $gt: 0 } }),
      StoreBatchModel.aggregate([{ $match: { active: true, quantity: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$purchaseCost'] } } } }]),
      StorePurchaseModel.find().sort({ createdAt: -1 }).limit(5).lean(),
      StoreSupplierModel.aggregate([{ $group: { _id: null, total: { $sum: '$outstanding' } } }]),
      StoreSupplierModel.countDocuments({ status: 'Active' }),
      StorePurchaseModel.aggregate([
        { $match: { date: new Date().toISOString().slice(0, 10) } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      StoreIssueModel.aggregate([
        { $match: { date: new Date().toISOString().slice(0, 10) } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
    ])

    res.json({
      stats: {
        totalItems,
        totalSuppliers,
        totalStockValue: totalValue[0]?.total || 0,
        pendingPayments: pendingPayments[0]?.total || 0,
        todayPurchases: todayPurchases[0]?.total || 0,
        todayIssues: todayIssues[0]?.total || 0,
      },
      alerts: {
        lowStock,
        outOfStock,
        expiringSoon,
        expired: 0,
      },
      recentPurchases,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== CATEGORIES ====================
export const listCategories = async (req: Request, res: Response) => {
  try {
    const categories = await StoreCategoryModel.find().sort({ name: 1 }).lean()
    res.json({ categories })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, active } = req.body
    const cat = await StoreCategoryModel.create({ name, description, active: active ?? true })
    res.status(201).json({ category: cat })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, description, active } = req.body
    const cat = await StoreCategoryModel.findByIdAndUpdate(id, { name, description, active }, { new: true })
    if (!cat) return res.status(404).json({ error: 'Category not found' })
    res.json({ category: cat })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const cat = await StoreCategoryModel.findByIdAndDelete(id)
    if (!cat) return res.status(404).json({ error: 'Category not found' })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== SUPPLIERS ====================
export const listSuppliers = async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query
    const { page, limit, skip } = getPagination(req.query)

    const filter: any = {}
    if (status) filter.status = status
    if (search) {
      const s = new RegExp(search as string, 'i')
      filter.$or = [{ name: s }, { company: s }, { phone: s }]
    }

    const [suppliers, total] = await Promise.all([
      StoreSupplierModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      StoreSupplierModel.countDocuments(filter),
    ])

    res.json({ suppliers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const createSupplier = async (req: Request, res: Response) => {
  try {
    const { name, company, phone, address, taxId, status } = req.body
    const sup = await StoreSupplierModel.create({ name, company, phone, address, taxId, status: status || 'Active' })
    res.status(201).json({ supplier: sup })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, company, phone, address, taxId, status } = req.body
    const sup = await StoreSupplierModel.findByIdAndUpdate(id, { name, company, phone, address, taxId, status }, { new: true })
    if (!sup) return res.status(404).json({ error: 'Supplier not found' })
    res.json({ supplier: sup })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const sup = await StoreSupplierModel.findByIdAndDelete(id)
    if (!sup) return res.status(404).json({ error: 'Supplier not found' })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const getSupplierLedger = async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params
    const { from, to } = req.query

    const supplier = await StoreSupplierModel.findById(supplierId).lean()
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' })

    const dateFilter: any = {}
    if (from) dateFilter.$gte = new Date(from as string)
    if (to) dateFilter.$lte = new Date(to as string)

    const purchases = await StorePurchaseModel.find({ supplierId, ...(Object.keys(dateFilter).length && { date: dateFilter }) }).sort({ date: 1 }).lean()
    const payments = await StoreSupplierPaymentModel.find({ supplierId, ...(Object.keys(dateFilter).length && { date: dateFilter }) }).sort({ date: 1 }).lean()

    const entries: any[] = []
    let balance = 0

    for (const p of purchases) {
      balance += p.totalAmount
      entries.push({
        id: String(p._id),
        date: p.date.toISOString().slice(0, 10),
        type: 'purchase',
        reference: p.invoiceNo,
        debit: p.totalAmount,
        credit: 0,
        balance,
      })
    }

    for (const pay of payments) {
      balance -= pay.amount
      entries.push({
        id: String(pay._id),
        date: pay.date.toISOString().slice(0, 10),
        type: 'payment',
        reference: pay.reference,
        description: pay.notes,
        debit: 0,
        credit: pay.amount,
        balance,
      })
    }

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    res.json({ supplier, entries })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const createSupplierPayment = async (req: Request, res: Response) => {
  try {
    const { supplierId, amount, method, reference, date, notes } = req.body
    const sup = await StoreSupplierModel.findById(supplierId)
    if (!sup) return res.status(404).json({ error: 'Supplier not found' })

    const payment = await StoreSupplierPaymentModel.create({
      supplierId,
      supplierName: sup.name,
      amount,
      method,
      reference,
      date: date ? new Date(date) : new Date(),
      notes,
      createdBy: (req as any).user?.id,
    })

    sup.paid = (sup.paid || 0) + amount
    sup.outstanding = Math.max(0, (sup.outstanding || 0) - amount)
    await sup.save()

    res.status(201).json({ payment })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

// ==================== INVENTORY ====================
export const listInventory = async (req: Request, res: Response) => {
  try {
    const { category, status, search } = req.query
    const { page, limit, skip } = getPagination(req.query)

    const filter: any = { active: true }
    if (category) filter.category = category
    if (status === 'low') filter.$expr = { $lte: ['$currentStock', '$minStock'] }
    if (status === 'out') filter.currentStock = 0
    if (search) {
      filter.name = new RegExp(search as string, 'i')
    }

    const [items, total] = await Promise.all([
      StoreItemModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      StoreItemModel.countDocuments(filter),
    ])

    res.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const createItem = async (req: Request, res: Response) => {
  try {
    const { name, category, unit, minStock } = req.body
    const item = await StoreItemModel.create({ name, category, unit, minStock: minStock || 0 })
    res.status(201).json({ item })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const updateItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, category, unit, minStock } = req.body
    const item = await StoreItemModel.findByIdAndUpdate(id, { name, category, unit, minStock }, { new: true })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    res.json({ item })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const listBatches = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params
    const batches = await StoreBatchModel.find({ itemId, active: true, quantity: { $gt: 0 } }).sort({ expiry: 1 }).lean()
    res.json({ batches })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== PURCHASES ====================
export const listPurchases = async (req: Request, res: Response) => {
  try {
    const { from, to, supplierId, search } = req.query
    const { page, limit, skip } = getPagination(req.query)

    const filter: any = {}
    if (from || to) {
      filter.date = {}
      if (from) filter.date.$gte = new Date(from as string)
      if (to) filter.date.$lte = new Date(to as string)
    }
    if (supplierId) filter.supplierId = supplierId
    if (search) {
      filter.$or = [
        { invoiceNo: new RegExp(search as string, 'i') },
        { supplierName: new RegExp(search as string, 'i') },
      ]
    }

    const [purchases, total] = await Promise.all([
      StorePurchaseModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
      StorePurchaseModel.countDocuments(filter),
    ])

    res.json({ purchases, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const createPurchase = async (req: Request, res: Response) => {
  try {
    const { date, invoiceNo, supplierId, supplierName, paymentMode, notes, items, totalAmount } = req.body

    const purchase = await StorePurchaseModel.create({
      date: new Date(date),
      invoiceNo,
      supplierId,
      supplierName,
      paymentMode,
      paymentStatus: paymentMode === 'cash' ? 'paid' : 'unpaid',
      totalAmount,
      notes,
      items: items.map((it: any) => ({
        itemName: it.itemName,
        category: it.category,
        batchNo: it.batchNo,
        quantity: it.quantity,
        unit: it.unit,
        purchaseCost: it.purchaseCost,
        mrp: it.mrp,
        expiry: it.expiry ? new Date(it.expiry) : undefined,
      })),
      createdBy: (req as any).user?.id,
    })

    // Update supplier totals
    await StoreSupplierModel.findByIdAndUpdate(supplierId, {
      $inc: { totalPurchases: totalAmount, outstanding: paymentMode === 'credit' ? totalAmount : 0 },
      lastOrder: new Date(),
    })

    // Create items and batches
    for (const it of items) {
      let item = await StoreItemModel.findOne({ name: it.itemName })
      if (!item) {
        item = await StoreItemModel.create({
          name: it.itemName,
          category: it.category,
          unit: it.unit,
          minStock: 0,
        })
      }

      const batch = await StoreBatchModel.create({
        itemId: item._id,
        batchNo: it.batchNo || `B${Date.now()}`,
        quantity: it.quantity,
        purchaseCost: it.purchaseCost,
        mrp: it.mrp,
        expiry: it.expiry ? new Date(it.expiry) : undefined,
        purchaseId: purchase._id,
        purchaseDate: new Date(date),
        supplierId,
        supplierName,
      })

      await StoreItemModel.findByIdAndUpdate(item._id, {
        $inc: { currentStock: it.quantity },
        $push: { batches: batch._id },
        lastPurchase: new Date(date),
        lastSupplier: supplierName,
        $set: { earliestExpiry: it.expiry ? new Date(it.expiry) : undefined },
      })
    }

    res.status(201).json({ purchase })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const getPurchase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const purchase = await StorePurchaseModel.findById(id).lean()
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' })
    res.json({ purchase })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== ISSUES ====================
export const listIssues = async (req: Request, res: Response) => {
  try {
    const { from, to, departmentId, search } = req.query
    const { page, limit, skip } = getPagination(req.query)

    const filter: any = {}
    if (from || to) {
      filter.date = {}
      if (from) filter.date.$gte = new Date(from as string)
      if (to) filter.date.$lte = new Date(to as string)
    }
    if (departmentId) filter.departmentId = departmentId
    if (search) {
      filter.$or = [
        { departmentName: new RegExp(search as string, 'i') },
        { issuedTo: new RegExp(search as string, 'i') },
      ]
    }

    const [issues, total] = await Promise.all([
      StoreIssueModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
      StoreIssueModel.countDocuments(filter),
    ])

    res.json({ issues, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const createIssue = async (req: Request, res: Response) => {
  try {
    const { date, departmentId, departmentName, issuedTo, notes, items, totalAmount } = req.body

    const issue = await StoreIssueModel.create({
      date: new Date(date),
      departmentId,
      departmentName,
      issuedTo,
      notes,
      items: items.map((it: any) => ({
        itemId: it.itemId,
        itemName: it.itemName,
        batchId: it.batchId,
        batchNo: it.batchNo,
        quantity: it.quantity,
        unit: it.unit,
        costPerUnit: it.costPerUnit,
      })),
      totalAmount,
      createdBy: (req as any).user?.id,
    })

    // Reduce batch quantities
    for (const it of items) {
      await StoreBatchModel.findByIdAndUpdate(it.batchId, { $inc: { quantity: -it.quantity } })
      await StoreItemModel.findByIdAndUpdate(it.itemId, { $inc: { currentStock: -it.quantity } })
    }

    res.status(201).json({ issue })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export const getIssue = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const issue = await StoreIssueModel.findById(id).lean()
    if (!issue) return res.status(404).json({ error: 'Issue not found' })
    res.json({ issue })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== ALERTS ====================
export const listAlerts = async (req: Request, res: Response) => {
  try {
    const { type, status } = req.query
    const filter: any = {}
    if (type) filter.type = type
    if (status) filter.status = status

    const alerts = await StoreAlertModel.find(filter).sort({ createdAt: -1 }).lean()
    res.json({ alerts })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const acknowledgeAlert = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const alert = await StoreAlertModel.findByIdAndUpdate(id, {
      status: 'acknowledged',
      acknowledgedBy: (req as any).user?.id,
      acknowledgedAt: new Date(),
    }, { new: true })
    if (!alert) return res.status(404).json({ error: 'Alert not found' })
    res.json({ alert })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const resolveAlert = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const alert = await StoreAlertModel.findByIdAndUpdate(id, {
      status: 'resolved',
      resolvedBy: (req as any).user?.id,
      resolvedAt: new Date(),
    }, { new: true })
    if (!alert) return res.status(404).json({ error: 'Alert not found' })
    res.json({ alert })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== REPORTS ====================
export const getReport = async (req: Request, res: Response) => {
  try {
    const { reportType } = req.params
    const { from, to, departmentId, supplierId } = req.query

    let data: any[] = []

    switch (reportType) {
      case 'stock': {
        const items = await StoreItemModel.find({ active: true }).lean()
        data = await Promise.all(items.map(async (item) => {
          const batches = await StoreBatchModel.find({ itemId: item._id, quantity: { $gt: 0 } }).lean()
          const value = batches.reduce((sum, b) => sum + b.quantity * b.purchaseCost, 0)
          return {
            name: item.name,
            category: item.category || '',
            stock: item.currentStock,
            minStock: item.minStock,
            value,
            status: item.currentStock === 0 ? 'out' : item.currentStock <= item.minStock ? 'low' : 'ok',
          }
        }))
        break
      }
      case 'department-usage': {
        const match: any = {}
        if (from || to) {
          match.date = {}
          if (from) match.date.$gte = new Date(from as string)
          if (to) match.date.$lte = new Date(to as string)
        }
        if (departmentId) match.departmentId = departmentId

        const agg = await StoreIssueModel.aggregate([
          { $match: match },
          { $group: { _id: '$departmentId', departmentName: { $first: '$departmentName' }, items: { $sum: { $size: '$items' } }, value: { $sum: '$totalAmount' }, lastIssue: { $max: '$date' } } },
          { $sort: { value: -1 } },
        ])
        data = agg.map(a => ({
          department: a.departmentName,
          items: a.items,
          value: a.value,
          lastIssue: a.lastIssue?.toISOString()?.slice(0, 10) || '',
        }))
        break
      }
      case 'expiry': {
        const batches = await StoreBatchModel.find({ active: true, quantity: { $gt: 0 }, expiry: { $exists: true } }).sort({ expiry: 1 }).lean()
        const now = new Date()
        data = batches.map(b => {
          const daysLeft = Math.ceil((new Date(b.expiry!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          return {
            name: b.itemName || '',
            batch: b.batchNo,
            expiry: b.expiry?.toISOString()?.slice(0, 10) || '',
            quantity: b.quantity,
            status: daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring_soon' : 'ok',
            daysLeft,
          }
        })
        break
      }
      case 'consumption': {
        const match: any = {}
        if (from || to) {
          match.date = {}
          if (from) match.date.$gte = new Date(from as string)
          if (to) match.date.$lte = new Date(to as string)
        }
        const agg = await StoreIssueModel.aggregate([
          { $match: match },
          { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, items: { $sum: { $size: '$items' } }, value: { $sum: '$totalAmount' } } },
          { $sort: { _id: 1 } },
        ])
        data = agg.map(a => ({ month: a._id, items: a.items, value: a.value, topItem: '' }))
        break
      }
      case 'supplier-purchases': {
        const match: any = {}
        if (supplierId) match.supplierId = supplierId
        if (from || to) {
          match.date = {}
          if (from) match.date.$gte = new Date(from as string)
          if (to) match.date.$lte = new Date(to as string)
        }
        const agg = await StorePurchaseModel.aggregate([
          { $match: match },
          { $group: { _id: '$supplierId', supplierName: { $first: '$supplierName' }, purchases: { $sum: 1 }, totalValue: { $sum: '$totalAmount' } } },
          { $sort: { totalValue: -1 } },
        ])
        const suppliers = await StoreSupplierModel.find().lean()
        data = agg.map(a => {
          const sup = suppliers.find(s => String(s._id) === String(a._id))
          return {
            supplier: a.supplierName,
            purchases: a.purchases,
            totalValue: a.totalValue,
            paid: sup?.paid || 0,
            outstanding: sup?.outstanding || 0,
          }
        })
        break
      }
      default:
        break
    }

    res.json({ data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

// ==================== DEPARTMENTS (for issue form) ====================
export const listDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await HospitalDepartment.find({ active: { $ne: false } }).sort({ name: 1 }).lean()
    res.json({ departments })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
