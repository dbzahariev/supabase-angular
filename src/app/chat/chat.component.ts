import { Component, OnInit } from '@angular/core';
import { SupabaseChatService, Message } from '../supabase-chat.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-chat',
    standalone: true,
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.css'],
    imports: [FormsModule, CommonModule]
})
export class ChatComponent implements OnInit {
    messages: Message[] = [];
    users: { id: number; name: string }[] = [];
    selectedUserId: number | null = null;
    newMessage = '';

    constructor(private chatService: SupabaseChatService) { }

    ngOnInit() {
        this.chatService.messages$.subscribe(msgs => {
            this.messages = msgs;
        });
        this.fetchUsers();
    }

    async fetchUsers() {
        let uniqueUsers = await this.fetchUsersWithLastBackupYear() ?? [{ id: 1, name: '' }];
        this.users = uniqueUsers;
        if (this.users.length > 0) {
            this.selectedUserId = this.users[0].id;
        }
    }

    async fetchUsersWithLastBackupYear() {
        let lastBackupYear = await this.getLastBackupYear();
        const { data, error } = await this.chatService['supabase']
            .from('users')
            .select('id, name, predictions!inner(backup_year)')
            .eq('predictions.backup_year', lastBackupYear);

        // Remove the predictions property from each user object
        if (data) {
            data.forEach((user: any) => {
                delete user.predictions;
            });
        }
        if (!error && data) {
            // Remove duplicate users if any
            const uniqueUsers = Array.from(new Map(data.map(u => [u.id, u])).values());
            return uniqueUsers;
        }
        return null;
    }

    async getLastBackupYear() {
        const { data, error } = await this.chatService['supabase']
            .from('predictions')
            .select('backup_year, date, user_id')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!error && data) {
            return data.backup_year;
        }
        return null;
    }

    async sendMessage() {
        if (this.selectedUserId && this.newMessage.trim()) {
            await this.chatService.sendMessage(this.selectedUserId, this.newMessage.trim());
            this.newMessage = '';
        }
    }
}
