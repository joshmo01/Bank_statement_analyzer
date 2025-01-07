import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import _ from 'lodash';

// BankAnalyzer class (from previous implementation)
class BankAnalyzer {
  constructor(transactions) {
    this.transactions = transactions;
    this.fraudThresholds = {
      velocityLimit: 5,
      largeTransactionThreshold: 500000,
      suspiciousTimeRange: { start: 23, end: 4 }
    };
  }

  analyzeTransactionPatterns() {
    const credits = this.transactions.filter(t => t.type === 'Credit');
    const debits = this.transactions.filter(t => t.type === 'Debit');

    return {
      regularIncome: _.chain(credits)
        .groupBy(t => t.amount)
        .filter(group => group.length >= 3)
        .value(),
      recurringExpenses: _.chain(debits)
        .groupBy(t => t.amount)
        .filter(group => group.length >= 2)
        .value()
    };
  }

  detectFraudIndicators() {
    const highVelocity = _.chain(this.transactions)
      .groupBy(t => new Date(t.date).toISOString().slice(0, 13))
      .filter(group => group.length > this.fraudThresholds.velocityLimit)
      .value();

    const unusualTiming = this.transactions.filter(t => {
      const hour = new Date(t.date).getHours();
      return hour >= this.fraudThresholds.suspiciousTimeRange.start || 
             hour <= this.fraudThresholds.suspiciousTimeRange.end;
    });

    return {
      highVelocity,
      unusualTiming
    };
  }

  analyzeBusinessOpportunities() {
    const balanceProfile = {
      averageBalance: _.mean(this.transactions.map(t => t.balance)),
      maxBalance: _.max(this.transactions.map(t => t.balance))
    };

    const digitalChannels = ['Net Banking Transfer', 'UPI', 'Card'];
    const digitalTransactions = this.transactions.filter(
      t => digitalChannels.includes(t.channel)
    ).length / this.transactions.length;

    const opportunities = {
      crossSell: [],
      upSell: []
    };

    if (digitalTransactions > 0.7) {
      opportunities.crossSell.push({
        product: 'Premium Credit Card',
        confidence: 0.8,
        reasoning: 'High digital transaction usage indicates comfort with cards'
      });
    }

    if (balanceProfile.averageBalance > 100000) {
      opportunities.crossSell.push({
        product: 'Mutual Fund Investment',
        confidence: 0.75,
        reasoning: 'Maintains healthy average balance'
      });
    }

    if (balanceProfile.maxBalance > 500000) {
      opportunities.upSell.push({
        product: 'Premium Banking Account',
        eligibility: 0.9,
        justification: 'High value transactions and balance maintenance'
      });
    }

    return opportunities;
  }
}

const BankStatementAnalyzer = () => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [balanceTrend, setBalanceTrend] = useState([]);

  const processFile = async (file) => {
    setLoading(true);
    setError(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {
        cellDates: true,
        cellNF: true,
        cellStyles: true
      });

      // Process transactions
      const transactionSheet = workbook.Sheets['Transactions'];
      if (!transactionSheet) {
        throw new Error('No Transactions sheet found in the uploaded file');
      }

      const transactions = XLSX.utils.sheet_to_json(transactionSheet, {header: 1})
        .slice(1) // Skip header
        .map(row => ({
          date: new Date(row[1]),
          amount: row[4],
          type: (row[9] || '').trim(),
          channel: row[5],
          balance: row[6]
        }))
        .filter(t => t.date && t.amount); // Filter out invalid rows

      // Process balance trend
      const balanceSheet = workbook.Sheets['Daily EOD Balances'];
      if (balanceSheet) {
        const balanceData = XLSX.utils.sheet_to_json(balanceSheet, {header: 1})
          .slice(1)
          .map(row => ({
            day: row[0],
            balance: row[3] || 0
          }))
          .filter(item => item.balance);
        setBalanceTrend(balanceData);
      }

      const analyzer = new BankAnalyzer(transactions);
      setResults({
        patterns: analyzer.analyzeTransactionPatterns(),
        fraudIndicators: analyzer.detectFraudIndicators(),
        opportunities: analyzer.analyzeBusinessOpportunities()
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      await processFile(file);
    } else {
      setError('Please upload an Excel (.xlsx) file');
    }
  };

  const handleFileInput = async (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      await processFile(file);
    } else {
      setError('Please upload an Excel (.xlsx) file');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Bank Statement Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('file-input').click()}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg mb-2">Drop your bank statement here or click to browse</p>
            <p className="text-sm text-gray-500">Supports Excel (.xlsx) files</p>
            <input
              id="file-input"
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-4">
            <p className="text-center">Analyzing your statement...</p>
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {results && (
        <div className="space-y-4">
          {/* Balance Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Balance Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={balanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="balance" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Fraud Alerts */}
          {results.fraudIndicators.highVelocity.length > 0 && (
            <Alert>
              <AlertTitle>High Velocity Transactions Detected</AlertTitle>
              <AlertDescription>
                Multiple transactions detected within short time periods.
              </AlertDescription>
            </Alert>
          )}

          {/* Transaction Patterns */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Regular Income Patterns</h3>
                  <p>{Object.keys(results.patterns.regularIncome).length} regular income sources identified</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Recurring Expenses</h3>
                  <p>{Object.keys(results.patterns.recurringExpenses).length} recurring payments identified</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Opportunities */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.opportunities.crossSell.map((opportunity, index) => (
                  <div key={index} className="p-4 border rounded">
                    <h3 className="font-medium">{opportunity.product}</h3>
                    <p className="text-sm text-gray-600">{opportunity.reasoning}</p>
                    <div className="mt-2">
                      Confidence: {(opportunity.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BankStatementAnalyzer;