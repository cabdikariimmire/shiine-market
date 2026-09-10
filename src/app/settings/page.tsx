'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Store, 
  Users, 
  Bell, 
  ShoppingCart, 
  Package, 
  Camera, 
  Palette, 
  Save, 
  CheckCircle2, 
  Mail, 
  Printer, 
  ShieldCheck,
  Globe,
  Plus,
  Edit,
  Trash2,
  Key,
  UserCheck,
  UserX,
  AlertTriangle,
  Search,
  History,
  FileText,
  Filter,
  ArrowRight
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { repository } from '@/lib/services/repository';
import { ShopSettings, SystemUser, UserRole, UserStatus, AuditLog } from '@/types';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/utils';
import { formatMoney } from '@/lib/calculations/financials';

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const { success, error, info } = useToast();
  const [activeTab, setActiveTab] = useState<'shop' | 'users' | 'audit' | 'notifications' | 'pos' | 'products' | 'ai' | 'appearance'>('shop');
  const [settings, setSettings] = useState<ShopSettings>({
    shopName: 'Tukaan Shiine Supermarket',
    shopPhone: '+252 61 5500112',
    shopAddress: 'Suuqa Bakaaraha, Mogadishu',
    currency: 'USD',
    receiptHeader: 'TUKAAN SHIINE SUPERMARKET\nSuuqa Bakaaraha, Mogadishu',
    receiptFooter: 'Mahadsanid! Soo Dhowow Mar Kale.',
    lowStockEmailEnabled: true,
    outOfStockEmailEnabled: true,
    alertRecipientEmail: 'admin@tukaan.so',
    debtOverdueDays: 7,
    defaultPurchaseUnit: 'kartoon',
    defaultSellingUnit: 'xabo',
    defaultConversionFactor: 50,
    aiDetectionConfidenceThreshold: 75,
    theme: 'light',
    language: 'so',
    dateFormat: 'DD/MM/YYYY',
  });

  // Users State
  const [usersList, setUsersList] = useState<SystemUser[]>([]);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('reporter');

  // Edit User State
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserRole>('reporter');
  const [editUserStatus, setEditUserStatus] = useState<UserStatus>('active');

  // Reset Password State
  const [resetPassUser, setResetPassUser] = useState<SystemUser | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  const loadSettings = async () => {
    try {
      const s = await repository.getSettings();
      setSettings(s);
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const u = await repository.getUsers();
      setUsersList(u);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await repository.getAuditLogs(auditSearch, auditEntityFilter, auditActionFilter);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    }
  };

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, auditSearch, auditEntityFilter, auditActionFilter]);

  const handleSave = async () => {
    try {
      await repository.updateSettings(settings);
      success('Habaynta waa la keydiyey!', 'Dhammaan wax ka beddelka waa la dhaqangeliyey.');
    } catch (err: any) {
      error('Khalad baa dhacay', err.message);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim()) {
      error('Geli magaca iyo email-ka');
      return;
    }

    try {
      await repository.createUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword || 'password123',
        role: newUserRole,
      });

      success('User cusub ayaa la sameeyey!', `${newUserName} (${newUserRole})`);
      setIsCreateUserOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('reporter');
      await loadUsers();
    } catch (err: any) {
      error('Lama samayn karin user-ka', err.message);
    }
  };

  const handleOpenEditUser = (u: SystemUser) => {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserEmail(u.email);
    setEditUserRole(u.role);
    setEditUserStatus(u.status);
  };

  const handleSaveEditUser = async () => {
    if (!editingUser) return;

    try {
      await repository.updateUser(editingUser.id, {
        name: editUserName.trim(),
        email: editUserEmail.trim(),
        role: editUserRole,
        status: editUserStatus,
      });

      success('Xogta user-ka waa la cusbooneysiiyey', editUserName);
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      error('Khalad', err.message);
    }
  };

  const handleToggleStatus = async (u: SystemUser) => {
    const actionName = u.status === 'active' ? 'xiro (deactivate)' : 'furto (reactivate)';
    if (confirm(`Ma hubtaa inaad ${actionName} user-ka "${u.name}"?`)) {
      try {
        await repository.toggleUserStatus(u.id);
        success(`User-ka xaaladdiisa waa la beddelay`, u.name);
        await loadUsers();
      } catch (err: any) {
        error('Khalad', err.message);
      }
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassUser) return;
    if (!newResetPassword || newResetPassword.length < 6) {
      error('Furaha sirta waa inuu ka koobnaadaa ugu yaraan 6 xaraf');
      return;
    }

    try {
      await repository.resetUserPassword(resetPassUser.id, newResetPassword);
      success('Furaha sirta ah waa la beddelay!', `User: ${resetPassUser.name}`);
      setResetPassUser(null);
      setNewResetPassword('');
      await loadUsers();
    } catch (err: any) {
      error('Khalad', err.message);
    }
  };

  const handleDeleteUser = async (u: SystemUser) => {
    if (confirm(`Ma hubtaa inaad tirtirto user-ka "${u.name}" (${u.email})?`)) {
      try {
        await repository.deleteUser(u.id);
        success('User-ka waa la tirtiray', u.name);
        await loadUsers();
      } catch (err: any) {
        error('Lama tirtiri karin user-ka', err.message);
      }
    }
  };

  const renderCleanValues = (val: any) => {
    if (!val || typeof val !== 'object') return String(val ?? '—');
    const filtered = { ...val };
    delete filtered.password;
    delete filtered.password_hash;
    delete filtered.apiKey;
    return JSON.stringify(filtered, null, 2);
  };

  return (
    <AppShell title="Settings">
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="h-6 w-6 text-emerald-600" />
              Habaynta Guud ee Nidaamka (Settings)
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Maamul xogta dukaanka, user-rada & ogolaanshaha, diiwaanka isbeddellada, ogaysiisyada, iyo halbeegyada
            </p>
          </div>

          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-md shadow-emerald-600/20">
            <Save className="h-4 w-4" />
            Keydi Dhammaan Habaynta
          </Button>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2 scrollbar-none">
          {[
            { id: 'shop', label: 'Dukaanka (Shop Profile)', icon: Store },
            { id: 'users', label: 'Users & Ogolaanshaha', icon: Users },
            { id: 'audit', label: 'Diiwaanka Isbeddellada (Audit)', icon: ShieldCheck },
            { id: 'notifications', label: 'Ogaysiisyada (Email Alerts)', icon: Bell },
            { id: 'pos', label: 'POS & Rasiidhka', icon: ShoppingCart },
            { id: 'products', label: 'Alaabta & Halbeegyada', icon: Package },
            { id: 'ai', label: 'AI & Kaamirada', icon: Camera },
            { id: 'appearance', label: 'Muuqaalka & Afka', icon: Palette },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: SHOP PROFILE */}
        {activeTab === 'shop' && (
          <Card className="p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white">Xogta Guud ee Dukaanka</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Magaca Dukaanka</label>
                <Input
                  value={settings.shopName}
                  onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Taleefanka Dukaanka</label>
                <Input
                  value={settings.shopPhone}
                  onChange={(e) => setSettings({ ...settings, shopPhone: e.target.value })}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Cinwaanka (Address)</label>
                <Input
                  value={settings.shopAddress}
                  onChange={(e) => setSettings({ ...settings, shopAddress: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Lacagta (Currency)</label>
                <Input
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="mt-1 font-mono font-bold"
                />
              </div>
            </div>
          </Card>
        )}

        {/* TAB 2: USERS & ROLES MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-600" />
                  Maamulka Users-ka & Doorka (User Roles)
                </h3>
                <p className="text-xs text-slate-500">
                  U samee koontooyin shaqaalaha adigoo siinaya doorka saxda ah (Admin: Full Access, Reporter: Read-Only).
                </p>
              </div>

              <Button
                onClick={() => setIsCreateUserOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <Plus className="h-4 w-4" /> Samee User Cusub
              </Button>
            </div>

            {/* Users Table */}
            <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="px-4 py-3.5">User (Magaca)</th>
                      <th className="px-4 py-3.5">Email</th>
                      <th className="px-4 py-3.5">Doorka (Role)</th>
                      <th className="px-4 py-3.5 text-center">Xaaladda</th>
                      <th className="px-4 py-3.5 text-right">Hawlaha (Actions)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black text-xs">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{u.name}</span>
                          {currentUser?.id === u.id && (
                            <span className="text-[10px] text-emerald-600 font-bold">(Adiga)</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                          {u.email}
                        </td>

                        <td className="px-4 py-3.5">
                          {u.role === 'admin' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                              Admin (Full Access)
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold">
                              Reporter (Read-Only)
                            </Badge>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          {u.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Inactive
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditUser(u)}
                            className="h-7 text-xs font-bold text-slate-600 hover:text-slate-900"
                            title="Wax ka beddel"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setResetPassUser(u);
                              setNewResetPassword('');
                            }}
                            className="h-7 text-xs font-bold text-amber-600 hover:text-amber-700"
                            title="Beddel Furaha"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleStatus(u)}
                            className={`h-7 text-xs font-bold ${
                              u.status === 'active' 
                                ? 'text-orange-600 hover:text-orange-700' 
                                : 'text-emerald-600 hover:text-emerald-700'
                            }`}
                            title={u.status === 'active' ? 'Demi (Deactivate)' : 'Fur (Reactivate)'}
                          >
                            {u.status === 'active' ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteUser(u)}
                            className="h-7 text-xs font-bold text-red-600 hover:text-red-700"
                            title="Tirtir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: AUDIT LOGS (Diiwaanka Isbeddellada) */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  Diiwaanka Isbeddellada Nidaamka (Audit Trail Log)
                </h3>
                <p className="text-xs text-slate-500">
                  Taariikhda rasmiga ah ee dhammaan wax ka beddelka, sixitaanka, voids-ka, iyo hagaajinta stock-ga oo leh qofka sameeyey iyo sababta.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs">
                  {auditLogs.length} Diiwaan
                </Badge>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Ka baadh qofka, sababta, ID..."
                  className="pl-9 h-9 text-xs bg-white dark:bg-slate-900"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                />
              </div>

              <select
                value={auditEntityFilter}
                onChange={(e) => setAuditEntityFilter(e.target.value)}
                className="h-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold"
              >
                <option value="">Dhammaan Qeybaha (Entities)</option>
                <option value="sale">Iibka (Sale)</option>
                <option value="product">Alaabta (Product)</option>
                <option value="variant">Nooca Alaabta (Variant)</option>
                <option value="stock_adjustment">Sixid Stock (Stock Adjustment)</option>
                <option value="debt">Daynta (Debt)</option>
                <option value="debt_payment">Bixinta Daynta (Debt Payment)</option>
                <option value="supplier_transaction">Iibsashada Qeybiye (Purchase)</option>
                <option value="expense">Kharashka (Expense)</option>
                <option value="customer">Macmiilka (Customer)</option>
                <option value="supplier">Alaab-qeybiye (Supplier)</option>
                <option value="category">Qaybaha (Category)</option>
                <option value="user">Users (Koontooyinka)</option>
                <option value="settings">Habaynta (Settings)</option>
              </select>

              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="h-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold"
              >
                <option value="">Dhammaan Hawlaha (Actions)</option>
                <option value="update">Wax ka beddel (Update)</option>
                <option value="correction">Sixid (Correction)</option>
                <option value="stock_adjustment">Sixid Kaydka (Stock Adjustment)</option>
                <option value="void">Laalis (Void)</option>
                <option value="delete">Tirtirid (Delete)</option>
                <option value="create">Abuurid (Create)</option>
              </select>
            </div>

            {/* Audit Logs Table */}
            <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Taariikhda & Saacadda</th>
                      <th className="px-4 py-3">User & Role</th>
                      <th className="px-4 py-3">Hawsha (Action)</th>
                      <th className="px-4 py-3">Qeybta (Entity)</th>
                      <th className="px-4 py-3">Sababta (Reason)</th>
                      <th className="px-4 py-3 text-right">Faahfaahin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400">
                          Diiwaan laguma helin
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                            {formatDate(log.created_at)}
                          </td>

                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-900 dark:text-white">{log.user_name || 'Admin'}</p>
                            <span className="text-[10px] uppercase font-bold text-emerald-600 font-mono">
                              {log.user_role || 'admin'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              log.action.includes('adjustment')
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : log.action.includes('correction')
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : log.action.includes('void') || log.action.includes('delete')
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {log.action}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                            <span>{log.entity_type}</span>
                            <span className="block font-mono text-[10px] text-slate-400">
                              #{log.entity_id ? log.entity_id.slice(-6).toUpperCase() : '—'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                            {log.reason || '—'}
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedAuditLog(log)}
                              className="h-7 px-2 text-xs font-bold text-slate-600 hover:text-emerald-600 gap-1"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Arag
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 4: NOTIFICATIONS & EMAIL ALERTS */}
        {activeTab === 'notifications' && (
          <Card className="p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-emerald-600" />
                Ogaysiisyada Kaydka & Email Alert
              </h3>
              <p className="text-xs text-slate-500">
                Nidaamku wuxuu si toos ah email ugu dirayaa maamulaha markii alaabtu yaraysato ama dhamaato, isagoo ka fogaanaya soo noqnoqosho aan loo baahnayn.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Email-ka Digniinta Kaydka Yar (Low Stock Alert)</p>
                  <p className="text-slate-500 text-[11px]">Dir email markii alaabtu gaadho ama ka hooseyso minimum stock.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.lowStockEmailEnabled}
                  onChange={(e) => setSettings({ ...settings, lowStockEmailEnabled: e.target.checked })}
                  className="h-5 w-5 text-emerald-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Email-ka Alaabta Dhamaatay (Out of Stock Alert)</p>
                  <p className="text-slate-500 text-[11px]">Dir email degdeg ah markii stock-gu noqdo 0.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.outOfStockEmailEnabled}
                  onChange={(e) => setSettings({ ...settings, outOfStockEmailEnabled: e.target.checked })}
                  className="h-5 w-5 text-emerald-600 rounded"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Email-ka Loo Dirayo Digniinta</label>
                <Input
                  type="email"
                  value={settings.alertRecipientEmail}
                  onChange={(e) => setSettings({ ...settings, alertRecipientEmail: e.target.value })}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Muddada Digniinta Daynta (Maalmo)</label>
                <Input
                  type="number"
                  value={settings.debtOverdueDays}
                  onChange={(e) => setSettings({ ...settings, debtOverdueDays: Number(e.target.value) })}
                  className="mt-1 font-mono"
                />
              </div>
            </div>
          </Card>
        )}

        {/* TAB 5: POS & RECEIPT SETTINGS */}
        {activeTab === 'pos' && (
          <Card className="p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Printer className="h-5 w-5 text-emerald-600" />
              Habaynta Rasiidhka & Daabacaadda
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Qoraalka Sare ee Rasiidhka (Header)</label>
                <Input
                  value={settings.receiptHeader}
                  onChange={(e) => setSettings({ ...settings, receiptHeader: e.target.value })}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Qoraalka Hoose ee Rasiidhka (Footer Note)</label>
                <Input
                  value={settings.receiptFooter}
                  onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                  className="mt-1 font-mono"
                />
              </div>
            </div>
          </Card>
        )}

        {/* TAB 6: PRODUCTS & BULK CONVERSIONS */}
        {activeTab === 'products' && (
          <Card className="p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              Halbeegyada & Bulk Conversion Defaults
            </h3>

            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Halbeegga Soo Iibka Default</label>
                <Input
                  value={settings.defaultPurchaseUnit}
                  onChange={(e) => setSettings({ ...settings, defaultPurchaseUnit: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Halbeegga Iibinta Default</label>
                <Input
                  value={settings.defaultSellingUnit}
                  onChange={(e) => setSettings({ ...settings, defaultSellingUnit: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Conversion Default (1 Jawan =)</label>
                <Input
                  type="number"
                  value={settings.defaultConversionFactor}
                  onChange={(e) => setSettings({ ...settings, defaultConversionFactor: Number(e.target.value) })}
                  className="mt-1 font-mono"
                />
              </div>
            </div>
          </Card>
        )}

        {/* TAB 7: AI SETTINGS */}
        {activeTab === 'ai' && (
          <Card className="p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Camera className="h-5 w-5 text-emerald-600" />
              Habaynta AI Vision & OCR
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Heerka Hubnaanta AI ee Ugu Yar (Confidence Threshold %): {settings.aiDetectionConfidenceThreshold}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={settings.aiDetectionConfidenceThreshold}
                  onChange={(e) => setSettings({ ...settings, aiDetectionConfidenceThreshold: Number(e.target.value) })}
                  className="w-full mt-2"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900 text-[11px] text-emerald-800 dark:text-emerald-300">
                ✓ <strong>Human Confirmation Requirement:</strong> AI ma beddeli karto kaydka iyadoon shaqaaluhu gujin "Xaqiiji".
              </div>
            </div>
          </Card>
        )}

        {/* TAB 8: APPEARANCE */}
        {activeTab === 'appearance' && (
          <Card className="p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Palette className="h-5 w-5 text-emerald-600" />
              Muuqaalka & Luuqadda
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Luuqadda Nidaamka</label>
                <Input value="Af-Soomaali (Somali)" disabled className="mt-1 bg-slate-100 dark:bg-slate-800 font-bold" />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Habka Taariikhda</label>
                <Input value={settings.dateFormat} onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })} className="mt-1 font-mono" />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* CREATE USER MODAL */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
            <Plus className="h-5 w-5 text-emerald-600" />
            Samee User Cusub
          </DialogTitle>
          <DialogDescription>
            Geli faahfaahinta user-ka iyo doorka aad u qoondeynayso
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Magaca Buuxa *</label>
            <Input
              placeholder="Tusaale: Ahmed Ali"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Email *</label>
            <Input
              type="email"
              placeholder="tusaale@tukaan.so"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Furaha Sirta ah (Password) *</label>
            <Input
              type="password"
              placeholder="Ugu yaraan 6 xaraf"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Doorka (Role) *</label>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as UserRole)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-bold"
            >
              <option value="admin">Admin — Full Access (Dhammaan qeybaha & maaraynta)</option>
              <option value="reporter">Reporter — Read-Only (Dashboard & Warbixinnada kaliya)</option>
            </select>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCreateUserOpen(false)}>
            Ka noqo
          </Button>
          <Button onClick={handleCreateUser} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Keydi User-ka
          </Button>
        </DialogFooter>
      </Dialog>

      {/* EDIT USER MODAL */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
            <Edit className="h-5 w-5 text-emerald-600" />
            Wax ka beddel User-ka
          </DialogTitle>
          <DialogDescription>
            Beddel xogta, doorka, ama xaaladda user-ka
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Magaca</label>
            <Input
              value={editUserName}
              onChange={(e) => setEditUserName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Email</label>
            <Input
              type="email"
              value={editUserEmail}
              onChange={(e) => setEditUserEmail(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Doorka (Role)</label>
              <select
                value={editUserRole}
                onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-bold"
              >
                <option value="admin">Admin (Full Access)</option>
                <option value="reporter">Reporter (Read-Only)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Xaaladda (Status)</label>
              <select
                value={editUserStatus}
                onChange={(e) => setEditUserStatus(e.target.value as UserStatus)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-bold"
              >
                <option value="active">Active (Furan)</option>
                <option value="inactive">Inactive (Xiran)</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setEditingUser(null)}>
            Ka noqo
          </Button>
          <Button onClick={handleSaveEditUser} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Keydi Wax Ka Beddelka
          </Button>
        </DialogFooter>
      </Dialog>

      {/* RESET PASSWORD MODAL */}
      <Dialog open={!!resetPassUser} onOpenChange={(open) => !open && setResetPassUser(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
            <Key className="h-5 w-5 text-amber-600" />
            Beddel Furaha Sirta ah (Reset Password)
          </DialogTitle>
          <DialogDescription>
            Geli furaha sirta ah ee cusub ee user: {resetPassUser?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Furaha Sirta ah ee Cusub *</label>
            <Input
              type="password"
              placeholder="Ugu yaraan 6 xaraf"
              value={newResetPassword}
              onChange={(e) => setNewResetPassword(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setResetPassUser(null)}>
            Ka noqo
          </Button>
          <Button onClick={handleResetPassword} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
            Beddel Furaha
          </Button>
        </DialogFooter>
      </Dialog>

      {/* AUDIT LOG DETAILS MODAL */}
      <Dialog open={!!selectedAuditLog} onOpenChange={(open) => !open && setSelectedAuditLog(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Faahfaahinta Diiwaanka Isbeddelka
          </DialogTitle>
          <DialogDescription>
            ID: <span className="font-mono">{selectedAuditLog?.id}</span> | Taariikhda: <span className="font-mono">{selectedAuditLog ? formatDate(selectedAuditLog.created_at) : ''}</span>
          </DialogDescription>
        </DialogHeader>

        {selectedAuditLog && (
          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-slate-400 font-bold uppercase text-[10px]">User & Doorka</p>
                <p className="font-black text-slate-900 dark:text-white mt-0.5">
                  {selectedAuditLog.user_name || 'Admin'} ({selectedAuditLog.user_role || 'admin'})
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase text-[10px]">Hawsha & Qeybta</p>
                <p className="font-black text-emerald-600 mt-0.5 uppercase">
                  {selectedAuditLog.action} → {selectedAuditLog.entity_type}
                </p>
              </div>
            </div>

            <div>
              <p className="font-bold text-slate-700 dark:text-slate-300">Sababta Isbeddelka (Reason):</p>
              <p className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 font-medium mt-1">
                {selectedAuditLog.reason || 'Wax sabab ah lama qorin'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300">Xogtii Hore (Previous Values):</p>
                <pre className="mt-1 p-2.5 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px] overflow-x-auto max-h-48">
                  {renderCleanValues(selectedAuditLog.previous_values)}
                </pre>
              </div>

              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300">Xogta Cusub (New Values):</p>
                <pre className="mt-1 p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900 font-mono text-[11px] text-emerald-800 dark:text-emerald-300 overflow-x-auto max-h-48">
                  {renderCleanValues(selectedAuditLog.new_values)}
                </pre>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedAuditLog(null)}>
            Xidh
          </Button>
        </DialogFooter>
      </Dialog>
    </AppShell>
  );
}
