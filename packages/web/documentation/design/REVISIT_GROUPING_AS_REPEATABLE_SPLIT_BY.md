On the /browse page, we have a "Group" search param that lets you group by a particular tag group.

This is a small fraction of what we should be doing with this.

I want to:
- Group by day, month, year, decade source_created_at
- Group by day, month, year, decade created_at
- Group by day, month, year, decade updated_at

I want to combine a group by username (tag_group: username), then group by month uploaded (source_created_at: desc)

the current Group text box search mode should be replaced with an UI that conveys to the user they are "applying" another dimension on top of their current browse view. We can do this with a "< + Split >" button.
