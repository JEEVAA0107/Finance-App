const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

// GET /api/schemes
router.get('/', authenticate, async (req, res) => {
  try {
    const where = {};
    if (req.user.companyId) {
      where.companyId = req.user.companyId;
    }
    const schemes = await prisma.loanScheme.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: schemes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/schemes
router.post('/', authenticate, async (req, res) => {
  try {
    // Only Admin or Super Admin should create schemes
    if (req.user.role === 'AGENT' || req.user.role === 'CUSTOMER') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { name, calculationMethod, interestRate, processingFee, penaltyName, penaltyRate } = req.body;
    
    if (!name || !calculationMethod) {
      return res.status(400).json({ success: false, message: 'Name and Calculation Method are required' });
    }

    const newScheme = await prisma.loanScheme.create({
      data: {
        companyId: req.user.companyId || null,
        name,
        calculationMethod,
        interestRate: parseFloat(interestRate) || 0,
        processingFee: parseFloat(processingFee) || 0,
        penaltyName: penaltyName || 'Late Fee',
        penaltyRate: parseFloat(penaltyRate) || 0,
      }
    });

    await auditLog(req.user.id, 'CREATE_SCHEME', 'LoanScheme', newScheme.id, { name }, req);
    res.status(201).json({ success: true, data: newScheme });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/schemes/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'AGENT' || req.user.role === 'CUSTOMER') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const scheme = await prisma.loanScheme.findUnique({ where: { id: req.params.id } });
    if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });
    
    if (req.user.companyId && scheme.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, calculationMethod, interestRate, processingFee, penaltyName, penaltyRate, isActive } = req.body;

    const updated = await prisma.loanScheme.update({
      where: { id: req.params.id },
      data: {
        name,
        calculationMethod,
        interestRate: parseFloat(interestRate) || 0,
        processingFee: parseFloat(processingFee) || 0,
        penaltyName: penaltyName || 'Late Fee',
        penaltyRate: parseFloat(penaltyRate) || 0,
        isActive: isActive !== undefined ? isActive : scheme.isActive,
      }
    });

    await auditLog(req.user.id, 'UPDATE_SCHEME', 'LoanScheme', updated.id, { name }, req);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/schemes/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'AGENT' || req.user.role === 'CUSTOMER') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const scheme = await prisma.loanScheme.findUnique({ where: { id: req.params.id } });
    if (!scheme) return res.status(404).json({ success: false, message: 'Scheme not found' });
    
    if (req.user.companyId && scheme.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await prisma.loanScheme.delete({ where: { id: req.params.id } });
    await auditLog(req.user.id, 'DELETE_SCHEME', 'LoanScheme', req.params.id, {}, req);
    res.json({ success: true, message: 'Scheme deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
