'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://limegwikspehbxqoqdnp.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpbWVnd2lrc3BlaGJ4cW9xZG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NDQxNTksImV4cCI6MjEwMDQyMDE1OX0.0h3wsqH7MouQ3V-Mbgq_-B9pBSOG5034iHCAuMEQqXo';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MEMBERS = [
  'Hoa Boss', 'Tuyến', 'Tú', 'Nhàn', 'Đạt', 'Thành', 
  'Thủy', 'Dung', 'Thoại Anh', 'Chi', 'Như', 'Vân', 
  'Phúc', 'Diệu', 'Khoa',
];

interface Transaction {
  from: string;
  to: string;
  amount: number;
}

export default function Home() {
  const [payer, setPayer] = useState('Hoa Boss');
  const [totalBill, setTotalBill] = useState('');
  const [note, setNote] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [settlements, setSettlements] = useState<Transaction[]>([]);

  // State chọn Tháng/Năm xem báo cáo (Mặc định là tháng/năm hiện tại)
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1 - 12
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // Hàm tính toán ai chuyển tiền cho ai dựa trên Supabase Data & Tháng được chọn
  const calculateSettlements = async (month: number, year: number) => {
    const startOfMonth = new Date(year, month - 1, 1).toISOString();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth);
      
    if (error || !expenses) return;

    // 1. Tính Net Balance
    const netBalances: { [key: string]: number } = {};
    MEMBERS.forEach((m) => (netBalances[m] = 0));

    expenses.forEach((item) => {
      netBalances[item.payer] = (netBalances[item.payer] || 0) + Number(item.amount);
      netBalances[item.consumer] = (netBalances[item.consumer] || 0) - Number(item.amount);
    });

    // 2. Phân loại người nợ/người nhận
    let debtors: { name: string; amount: number }[] = [];
    let creditors: { name: string; amount: number }[] = [];

    Object.keys(netBalances).forEach((name) => {
      const bal = Math.round(netBalances[name]);
      if (bal < 0) debtors.push({ name, amount: -bal });
      else if (bal > 0) creditors.push({ name, amount: bal });
    });

    // 3. Thuật toán triệt tiêu nợ
    const results: Transaction[] = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const minAmount = Math.min(debtor.amount, creditor.amount);

      if (minAmount > 0) {
        results.push({
          from: debtor.name,
          to: creditor.name,
          amount: minAmount,
        });
      }

      debtor.amount -= minAmount;
      creditor.amount -= minAmount;

      if (debtor.amount <= 0) i++;
      if (creditor.amount <= 0) j++;
    }

    setSettlements(results);
  };

  // Tự động load lại báo cáo khi đổi Tháng/Năm trên dropdown
  useEffect(() => {
    calculateSettlements(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  const toggleMember = (member: string) => {
    if (selectedMembers.includes(member)) {
      setSelectedMembers(selectedMembers.filter((m) => m !== member));
    } else {
      setSelectedMembers([...selectedMembers, member]);
    }
  };

  const handleSubmit = async () => {
    setMessage('');
    const billAmount = Number(totalBill);

    if (!billAmount || billAmount <= 0) {
      setMessage('⚠️ Vui lòng nhập tổng hóa đơn hợp lệ!');
      return;
    }

    if (selectedMembers.length === 0) {
      setMessage('⚠️ Vui lòng chọn ít nhất 1 người chịu tiền!');
      return;
    }

    if (splitType === 'custom') {
      const totalCustom = selectedMembers.reduce(
        (sum, m) => sum + Number(customAmounts[m] || 0),
        0
      );
      if (totalCustom !== billAmount) {
        setMessage(
          `⚠️ Tổng tiền nhập riêng (${totalCustom.toLocaleString('vi-VN')}đ) chưa bằng Tổng hóa đơn (${billAmount.toLocaleString('vi-VN')}đ)!`
        );
        return;
      }
    }

    setLoading(true);

    try {
      let recordsToInsert = [];

      if (splitType === 'equal') {
        const shareAmount = billAmount / selectedMembers.length;
        recordsToInsert = selectedMembers.map((member) => ({
          payer,
          consumer: member,
          amount: shareAmount,
          total_bill: billAmount,
          split_type: 'equal',
          note,
        }));
      } else {
        recordsToInsert = selectedMembers.map((member) => ({
          payer,
          consumer: member,
          amount: Number(customAmounts[member] || 0),
          total_bill: billAmount,
          split_type: 'custom',
          note,
        }));
      }

      const { error } = await supabase.from('expenses').insert(recordsToInsert);
      if (error) throw error;

      setMessage('🎉 Đã ghi nhận chia tiền thành công!');
      setTotalBill('');
      setNote('');
      setSelectedMembers([]);
      setCustomAmounts({});

      calculateSettlements(selectedMonth, selectedYear);
    } catch (err: any) {
      setMessage(`❌ Lỗi: ${err.message || 'Không thể lưu data'}`);
    } finally {
      setLoading(false);
    }
  };

  const currentCustomTotal = selectedMembers.reduce(
    (sum, m) => sum + Number(customAmounts[m] || 0),
    0
  );

  return (
    <main className="min-h-screen bg-[#f4f7fa] p-4 md:p-8 text-[#2a3479]">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[#2a3479] text-white rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            💰
          </div>
          <h1 className="text-3xl font-bold text-[#2a3479]">
            Chia Đơn Không Chia Ly
          </h1>
          <p className="text-sm text-gray-500 italic">nhắc nợ, không du di</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Tạo Hóa Đơn */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              🧾 Tạo hóa đơn mới
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Người trả tiền</label>
                <select
                  value={payer}
                  onChange={(e) => setPayer(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#01c2f3]"
                >
                  {MEMBERS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Tổng hóa đơn (VND)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={totalBill}
                  onChange={(e) => setTotalBill(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#01c2f3]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Ghi chú</label>
              <input
                type="text"
                placeholder="VD: Tiền ăn lẩu..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#01c2f3]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Cách chia</label>
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setSplitType('equal')}
                  className={`py-2 text-sm font-semibold rounded-lg transition ${
                    splitType === 'equal' ? 'bg-[#01c2f3] text-white shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Chia đều
                </button>
                <button
                  onClick={() => setSplitType('custom')}
                  className={`py-2 text-sm font-semibold rounded-lg transition ${
                    splitType === 'custom' ? 'bg-[#01c2f3] text-white shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Nhập số tiền riêng
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold">
                  Thành viên tham gia ({selectedMembers.length}/15)
                </label>
                {splitType === 'custom' && Number(totalBill) > 0 && (
                  <span
                    className={`text-xs font-bold ${
                      currentCustomTotal === Number(totalBill) ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    Đã nhập: {currentCustomTotal.toLocaleString('vi-VN')} / {Number(totalBill).toLocaleString('vi-VN')} đ
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {MEMBERS.map((member) => {
                  const isSelected = selectedMembers.includes(member);
                  return (
                    <div
                      key={member}
                      className={`p-2.5 rounded-xl border text-sm font-medium transition ${
                        isSelected
                          ? 'border-[#01c2f3] bg-[#e6f9fe] text-[#2a3479]'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div onClick={() => toggleMember(member)} className="cursor-pointer flex items-center gap-2">
                        <input type="checkbox" checked={isSelected} readOnly className="rounded accent-[#01c2f3]" />
                        <span className="truncate flex-1">{member}</span>
                      </div>

                      {splitType === 'custom' && isSelected && (
                        <div className="mt-2 pt-2 border-t border-[#01c2f3]/20">
                          <input
                            type="number"
                            placeholder="Nhập số tiền (VND)"
                            value={customAmounts[member] || ''}
                            onChange={(e) =>
                              setCustomAmounts({ ...customAmounts, [member]: e.target.value })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="w-full p-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#01c2f3] text-[#2a3479]"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {message && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-sm rounded-xl text-center">
                {message}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 bg-[#2a3479] hover:bg-[#1f275e] text-white font-bold rounded-xl shadow-md transition disabled:opacity-50"
            >
              {loading ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN CHIA TIỀN'}
            </button>
          </div>

          {/* Panel Thống Kê & Chọn Tháng */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-start space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-[#2a3479] text-base flex items-center gap-1">
                💸 Chốt Sổ Nợ
              </h3>
              
              {/* Dropdown Chọn Tháng/Năm */}
              <div className="flex items-center gap-1">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="text-xs p-1.5 bg-gray-100 font-semibold text-[#2a3479] rounded-lg border-0 focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, idx) => (
                    <option key={idx + 1} value={idx + 1}>Tháng {idx + 1}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="text-xs p-1.5 bg-gray-100 font-semibold text-[#2a3479] rounded-lg border-0 focus:outline-none"
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {settlements.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs">
                Không có dữ liệu nợ trong Tháng {selectedMonth}/{selectedYear}!
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                {settlements.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#f8fafc] border border-gray-100 rounded-xl space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-red-500 font-bold">{item.from}</span>
                      <span className="text-gray-400">chuyển cho</span>
                      <span className="text-emerald-600 font-bold">{item.to}</span>
                    </div>
                    <div className="text-right text-sm font-extrabold text-[#2a3479]">
                      {item.amount.toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
