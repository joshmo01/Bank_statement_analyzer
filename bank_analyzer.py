import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, time
from typing import Dict, List, Tuple
import json

class BankAnalyzer:
    def __init__(self, transactions_df: pd.DataFrame):
        self.transactions_df = transactions_df
        self.fraud_thresholds = {
            'velocity_limit': 5,  # Max transactions per hour
            'large_transaction': 500000,
            'suspicious_time_start': time(23, 0),
            'suspicious_time_end': time(4, 0)
        }

    def analyze_patterns(self) -> Dict:
        """Analyze transaction patterns."""
        credits = self.transactions_df[self.transactions_df['Transaction Type'].str.strip() == 'Credit']
        debits = self.transactions_df[self.transactions_df['Transaction Type'].str.strip() == 'Debit']

        # Regular income patterns
        regular_income = credits.groupby('Amount').filter(lambda x: len(x) >= 3)
        
        # Recurring expenses
        recurring_expenses = debits.groupby('Amount').filter(lambda x: len(x) >= 2)

        return {
            'regular_income': regular_income,
            'recurring_expenses': recurring_expenses,
            'income_count': len(regular_income),
            'expenses_count': len(recurring_expenses)
        }

    def detect_fraud(self) -> Dict:
        """Detect potential fraud indicators."""
        # High velocity transactions
        self.transactions_df['Hour'] = self.transactions_df['Date'].dt.strftime('%Y-%m-%d-%H')
        velocity_groups = self.transactions_df.groupby('Hour').filter(
            lambda x: len(x) > self.fraud_thresholds['velocity_limit']
        )

        # Unusual timing transactions
        self.transactions_df['time'] = self.transactions_df['Date'].dt.time
        unusual_timing = self.transactions_df[
            (self.transactions_df['time'] >= self.fraud_thresholds['suspicious_time_start']) |
            (self.transactions_df['time'] <= self.fraud_thresholds['suspicious_time_end'])
        ]

        return {
            'high_velocity': velocity_groups,
            'unusual_timing': unusual_timing,
            'alerts_count': len(velocity_groups) + len(unusual_timing)
        }

    def analyze_opportunities(self) -> Dict:
        """Identify business opportunities."""
        avg_balance = self.transactions_df['Balance'].mean()
        max_balance = self.transactions_df['Balance'].max()
        
        digital_channels = ['Net Banking Transfer', 'UPI', 'Card']
        digital_txns = self.transactions_df[
            self.transactions_df['Transaction Channel'].isin(digital_channels)
        ]
        digital_ratio = len(digital_txns) / len(self.transactions_df)

        opportunities = {
            'cross_sell': [],
            'up_sell': []
        }

        # Cross-sell opportunities
        if digital_ratio > 0.7:
            opportunities['cross_sell'].append({
                'product': 'Premium Credit Card',
                'confidence': 0.8,
                'reasoning': 'High digital transaction usage indicates comfort with cards'
            })

        if avg_balance > 100000:
            opportunities['cross_sell'].append({
                'product': 'Mutual Fund Investment',
                'confidence': 0.75,
                'reasoning': 'Maintains healthy average balance'
            })

        # Up-sell opportunities
        if max_balance > 500000:
            opportunities['up_sell'].append({
                'product': 'Premium Banking Account',
                'eligibility': 0.9,
                'justification': 'High value transactions and balance maintenance'
            })

        return opportunities

def process_excel(uploaded_file) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Process uploaded Excel file and return transaction and balance DataFrames."""
    try:
        # Read transactions
        transactions_df = pd.read_excel(uploaded_file, sheet_name='Transactions', engine='openpyxl')
        transactions_df['Date'] = pd.to_datetime(transactions_df['Date'])
        
        # Read and process balance data
        try:
            balance_df = pd.read_excel(uploaded_file, sheet_name='Daily EOD Balances', engine='openpyxl')
            
            # Melt the balance dataframe to get it in the correct format for plotting
            # First, ensure Day/Month is the index
            balance_df.set_index('Day/Month', inplace=True)
            
            # Melt the dataframe to convert columns to rows
            balance_df = balance_df.reset_index().melt(
                id_vars=['Day/Month'],
                var_name='Month',
                value_name='Balance'
            )
            
            # Convert Month column to datetime
            balance_df['Month'] = pd.to_datetime(balance_df['Month'])
            
            # Sort by Month and Day/Month
            balance_df = balance_df.sort_values(['Month', 'Day/Month'])
            
        except Exception as e:
            st.warning(f"Could not process balance data: {str(e)}")
            balance_df = pd.DataFrame()
        
        return transactions_df, balance_df
    except Exception as e:
        st.error(f"Error reading Excel file: {str(e)}")
        raise e

# Streamlit UI
st.set_page_config(page_title="Bank Statement Analyzer", layout="wide")

st.title("Bank Statement Analysis Dashboard")

# File upload
uploaded_file = st.file_uploader("Upload your bank statement", type=['xlsx'])

if uploaded_file is not None:
    try:
        with st.spinner('Processing your statement...'):
            # Process the file
            transactions_df, balance_df = process_excel(uploaded_file)
            analyzer = BankAnalyzer(transactions_df)

            # Create tabs for different analyses
            tab1, tab2, tab3, tab4 = st.tabs([
                "Overview", "Transaction Patterns", 
                "Fraud Indicators", "Business Opportunities"
            ])

            # Tab 1: Overview
            with tab1:
                st.header("Account Overview")
                
                # Balance trend
                if not balance_df.empty:
                    fig = px.line(
                        balance_df, 
                        x='Month',
                        y='Balance',
                        color='Day/Month',
                        title='Daily Balance Trend Across Months'
                    )
                    # Update layout for better readability
                    fig.update_layout(
                        xaxis_title="Month",
                        yaxis_title="Balance (₹)",
                        showlegend=True,
                        legend_title="Day of Month"
                    )
                    st.plotly_chart(fig, use_container_width=True)

                # Basic stats
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Total Transactions", len(transactions_df))
                with col2:
                    st.metric("Average Balance", f"₹{transactions_df['Balance'].mean():,.2f}")
                with col3:
                    st.metric("Total Volume", f"₹{transactions_df['Amount'].sum():,.2f}")

            # Tab 2: Transaction Patterns
            with tab2:
                st.header("Transaction Patterns")
                patterns = analyzer.analyze_patterns()

                # Pattern metrics
                col1, col2 = st.columns(2)
                with col1:
                    st.metric("Regular Income Sources", patterns['income_count'])
                with col2:
                    st.metric("Recurring Expenses", patterns['expenses_count'])

                # Transaction distribution
                fig = px.histogram(
                    transactions_df, 
                    x='Transaction Type', 
                    title='Transaction Distribution'
                )
                st.plotly_chart(fig, use_container_width=True)

            # Tab 3: Fraud Indicators
            with tab3:
                st.header("Fraud Detection")
                fraud_indicators = analyzer.detect_fraud()

                if len(fraud_indicators['high_velocity']) > 0:
                    st.warning(f"⚠️ High velocity transactions detected: {len(fraud_indicators['high_velocity'])} instances")
                    st.dataframe(fraud_indicators['high_velocity'])

                if len(fraud_indicators['unusual_timing']) > 0:
                    st.warning(f"⚠️ Unusual timing transactions detected: {len(fraud_indicators['unusual_timing'])} instances")
                    st.dataframe(fraud_indicators['unusual_timing'])

                if fraud_indicators['alerts_count'] == 0:
                    st.success("No suspicious activities detected")

            # Tab 4: Business Opportunities
            with tab4:
                st.header("Business Opportunities")
                opportunities = analyzer.analyze_opportunities()

                # Cross-sell opportunities
                st.subheader("Cross-Sell Recommendations")
                for opportunity in opportunities['cross_sell']:
                    with st.expander(opportunity['product']):
                        st.write(f"**Reasoning:** {opportunity['reasoning']}")
                        st.progress(opportunity['confidence'])
                        st.write(f"Confidence: {opportunity['confidence']*100:.1f}%")

                # Up-sell opportunities
                st.subheader("Up-Sell Recommendations")
                for opportunity in opportunities['up_sell']:
                    with st.expander(opportunity['product']):
                        st.write(f"**Justification:** {opportunity['justification']}")
                        st.progress(opportunity['eligibility'])
                        st.write(f"Eligibility Score: {opportunity['eligibility']*100:.1f}%")

    except Exception as e:
        st.error(f"Error processing file: {str(e)}")
else:
    st.info("Please upload your bank statement (Excel format) to begin analysis")