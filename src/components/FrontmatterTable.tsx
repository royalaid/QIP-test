import React from 'react';
import { format } from 'date-fns';
import { graphql } from 'gatsby';

import Author from './Author';

// Status color mapping
const statusColor: any = {
    Draft: '#757575',
    Review: '#FFEB3B',
    'Review Pending': '#FFEB3B',
    Vote: '#FFEB3B',
    'Vote Pending': '#FFEB3B',
    Rejected: '#F44336',
    Approved: '#4CAF50',
    Implemented: '#4CAF50',
    Superseded: '#9E9E9E',
    Withdrawn: '#9E9E9E',
};

interface Props {
    frontmatter: any;
}

const FrontmatterTable: React.FC<Props> = ({ frontmatter }) => {
    return (
        <table className="border border-collapse bg-muted/30 dark:bg-zinc-800/50 min-w-full divide-y divide-border">
            <tbody className="bg-card divide-y divide-border">
                <tr>
                    <th className="py-3 px-6 text-left font-bold">Author</th>
                    <td className="py-3 px-6">
                        <Author author={frontmatter.author} showName={true} />
                    </td>
                </tr>
                <tr>
                    <th className="py-3 px-6 text-left font-bold">Status</th>
                    <td className="py-3 px-6">
                        <span
                            style={{ backgroundColor: statusColor[frontmatter.status] || '#757575' }}
                            className="text-white text-xs px-3 py-1 rounded-full font-medium inline-block"
                        >
                            {frontmatter.status}
                        </span>
                    </td>
                </tr>
                {frontmatter.type && (
                    <tr>
                        <th className="py-3 px-6 text-left font-bold">Type</th>
                        <td className="py-3 px-6">{frontmatter.type}</td>
                    </tr>
                )}
                {frontmatter.network && (
                    <tr>
                        <th className="py-3 px-6 text-left font-bold">
                            Network
                        </th>
                        <td className="py-3 px-6">{frontmatter.network}</td>
                    </tr>
                )}
                <tr>
                    <th className="py-3 px-6 text-left font-bold">
                        Implementor
                    </th>
                    <td className="py-3 px-6">
                        {frontmatter.implementor || 'TBD'}
                    </td>
                </tr>
                <tr>
                    <th className="py-3 px-6 text-left font-bold">Release</th>
                    <td className="py-3 px-6">
                        {frontmatter.release || 'TBD'}
                    </td>
                </tr>
                {frontmatter.created && (
                    <tr>
                        <th className="py-3 px-6 text-left font-bold">
                            Created
                        </th>
                        <td className="py-3 px-6">
                            {format(
                                new Date(frontmatter.created),
                                'yyyy-MM-dd'
                            )}
                        </td>
                    </tr>
                )}
                {frontmatter.updated && (
                    <tr>
                        <th className="py-3 px-6 text-left font-bold">
                            Updated
                        </th>
                        <td className="py-3 px-6">
                            {format(
                                new Date(frontmatter.created),
                                'yyyy-MM-dd'
                            )}
                        </td>
                    </tr>
                )}
            </tbody>

            <tfoot>
                <tr className="bg-muted/30 dark:bg-zinc-800/50">
                    
                </tr>
            </tfoot>
        </table>
    );
};

// export const query = graphql`
//     query ($frontmatter__qip: Int) {
//         markdownRemark(frontmatter: { qip: { eq: $frontmatter__qip } }) {
//             fileAbsolutePath
//             frontmatter {
//                 qip
//                 title
//                 author
//                 network
//                 type
//                 proposal
//                 implementor
//                 release
//                 created
//                 updated
//                 status
//             }
//             html
//         }
//     }
// `;

export default FrontmatterTable;
