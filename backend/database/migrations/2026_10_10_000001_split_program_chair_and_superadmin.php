<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $programChairRoleId = $this->programChairRoleId($now);
        $superAdminRoleId = $this->roleId('super_admin', $now);

        $currentAdmin = DB::table('users')->where('email', 'superadmin@reservance.local')->first();
        $programChair = DB::table('users')->where('email', 'programchair@reservance.local')->first();

        if ($currentAdmin && ! $programChair) {
            DB::table('users')->where('id', $currentAdmin->id)->update([
                'name' => 'Program Chair',
                'email' => 'programchair@reservance.local',
                'role_id' => $programChairRoleId,
                'updated_at' => $now,
            ]);
        } elseif ($programChair) {
            DB::table('users')->where('id', $programChair->id)->update([
                'name' => 'Program Chair',
                'role_id' => $programChairRoleId,
                'status' => 'active',
                'updated_at' => $now,
            ]);
        }

        if (! DB::table('users')->where('email', 'superadmin@reservance.local')->exists()) {
            DB::table('users')->insert([
                'name' => 'Superadmin',
                'email' => 'superadmin@reservance.local',
                'password' => Hash::make('password'),
                'role_id' => $superAdminRoleId,
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } else {
            DB::table('users')->where('email', 'superadmin@reservance.local')->update([
                'name' => 'Superadmin',
                'role_id' => $superAdminRoleId,
                'status' => 'active',
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        $now = now();
        $superAdminRoleId = DB::table('roles')->where('name', 'super_admin')->value('id');
        $programChairRoleId = DB::table('roles')->where('name', 'program_chair')->value('id');

        if ($superAdminRoleId) {
            DB::table('users')->where('email', 'superadmin@reservance.local')->delete();
        }

        if ($programChairRoleId && $superAdminRoleId) {
            DB::table('users')->where('email', 'programchair@reservance.local')->update([
                'name' => 'Program Chair',
                'email' => 'superadmin@reservance.local',
                'role_id' => $superAdminRoleId,
                'updated_at' => $now,
            ]);
            DB::table('roles')->where('id', $programChairRoleId)->delete();
        }
    }

    private function programChairRoleId($now): int
    {
        $programChair = DB::table('roles')->where('name', 'program_chair')->first();
        if ($programChair) {
            return (int) $programChair->id;
        }

        $superAdmin = DB::table('roles')->where('name', 'super_admin')->first();
        if ($superAdmin) {
            DB::table('roles')->where('id', $superAdmin->id)->update([
                'name' => 'program_chair',
                'updated_at' => $now,
            ]);

            return (int) $superAdmin->id;
        }

        return $this->roleId('program_chair', $now);
    }

    private function roleId(string $name, $now): int
    {
        $existing = DB::table('roles')->where('name', $name)->value('id');
        if ($existing) {
            return (int) $existing;
        }

        return (int) DB::table('roles')->insertGetId([
            'name' => $name,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
};
