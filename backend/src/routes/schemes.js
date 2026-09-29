const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

// Default starter templates if no schemes exist for the company
const DEFAULT_SCHEMES = [
  {
    name: 'Standard Daily (Principal Recovery)',
    calculationMethod: 'METHOD_3_PRINCIPAL_ONLY',
    interestRate: 0,
    processingFee: 10,
    penaltyName: 'Late Fee',
    penaltyRate: 0,
  },
  {
    name: 'Fixed Rate (Standard Plan)',
    calculationMethod: 'METHOD_1_FIXED',
    interestRate: 2,
    processingFee: 0,
    penaltyName: 'Late Fee',
    penaltyRate: 0,
  },
  {
    name: 'Diminishing EMI (Amortized)',
    calculationMethod: 'METHOD_2_REDUCING',
    interestRate: 1.5,
    processingFee: 1,
    penaltyName: 'Late Fee',
    penaltyRate: 0,
  }
];

// GET /api/schemes
router.get('/', authenticate, async (req, res) => {
  try {
    const where = {};
    if (req.user.companyId) {
      where.companyId = req.user.companyId;
    }
    let schemes = await prisma.loanScheme.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Auto-seed starter templates if company has 0 schemes
    if (schemes.length === 0) {
      for (const ds of DEFAULT_SCHEMES) {
        await prisma.loanScheme.create({
          data: {
            ...ds,
            companyId: req.user.companyId || null,
          }
        });
      }
      schemes = await prisma.loanScheme.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });
    }

    res.json({ success: true, data: schemes });
  } catch (error) {
    console.error('Error fetching schemes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/schemes
router.post('/', authenticate, async (req, res) => {
  try {
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
        name: name.trim(),
        calculationMethod,
        interestRate: parseFloat(interestRate) || 0,
        processingFee: parseFloat(processingFee) || 0,
        penaltyName: (penaltyName && penaltyName.trim()) || 'Late Fee',
        penaltyRate: parseFloat(penaltyRate) || 0,
      }
    });

    try {
      await auditLog(req.user.id, 'CREATE_SCHEME', 'LoanScheme', newScheme.id, { name }, req);
    } catch (e) {}

    res.status(201).json({ success: true, data: newScheme });
  } catch (error) {
    console.error('Error creating scheme:', error);
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
    
    if (req.user.companyId && scheme.companyId && scheme.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, calculationMethod, interestRate, processingFee, penaltyName, penaltyRate, isActive } = req.body;

    const updated = await prisma.loanScheme.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name.trim() : scheme.name,
        calculationMethod: calculationMethod || scheme.calculationMethod,
        interestRate: interestRate !== undefined ? (parseFloat(interestRate) || 0) : scheme.interestRate,
        processingFee: processingFee !== undefined ? (parseFloat(processingFee) || 0) : scheme.processingFee,
        penaltyName: penaltyName !== undefined ? (penaltyName.trim() || 'Late Fee') : scheme.penaltyName,
        penaltyRate: penaltyRate !== undefined ? (parseFloat(penaltyRate) || 0) : scheme.penaltyRate,
        isActive: isActive !== undefined ? Boolean(isActive) : scheme.isActive,
      }
    });

    try {
      await auditLog(req.user.id, 'UPDATE_SCHEME', 'LoanScheme', updated.id, { name: updated.name }, req);
    } catch (e) {}

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating scheme:', error);
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
    
    if (req.user.companyId && scheme.companyId && scheme.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await prisma.loanScheme.delete({ where: { id: req.params.id } });
    try {
      await auditLog(req.user.id, 'DELETE_SCHEME', 'LoanScheme', req.params.id, {}, req);
    } catch (e) {}

    res.json({ success: true, message: 'Scheme deleted' });
  } catch (error) {
    console.error('Error deleting scheme:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
